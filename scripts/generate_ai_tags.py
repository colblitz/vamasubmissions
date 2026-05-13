#!/usr/bin/env python3
"""
AI tag suggestion generator for VAMA posts.

Three signal sources:
  1. Title rules       — keyword/phrase matching on post title (confidence=1.0)
  2. Char co-occurrence — tags that appear on >=70% of posts sharing a character
  3. CLIP ViT-B/32     — zero-shot image embedding cosine similarity vs tag text

Assumes a local copy of the prod DB is available. To refresh it:
  ssh -o LogLevel=ERROR deploy@vama "sudo -u postgres pg_dump --no-owner --no-acl vamasubmissions" > /tmp/vama_prod.sql
  dropdb --if-exists vamasubmissions_prod && createdb vamasubmissions_prod
  psql -d vamasubmissions_prod -f /tmp/vama_prod.sql

Usage:
  # Dry-run on all untagged posts:
  python generate_ai_tags.py --mode batch --dry-run

  # Process all posts (including already-tagged), write suggestions.json:
  python generate_ai_tags.py --mode batch --all --output suggestions.json

  # Single post:
  python generate_ai_tags.py --mode post 123456 --output suggestions.json

  # Title rules + co-occurrence only (no GPU):
  python generate_ai_tags.py --mode batch --no-clip --dry-run
"""

import argparse
import glob
import json
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path

# gfx1032 (RX 6400/6500 series) is not natively targeted by PyTorch ROCm 5.6
# which was built for gfx1030. Override to prevent segfault on first GPU op.
os.environ.setdefault("HSA_OVERRIDE_GFX_VERSION", "10.3.0")

import psycopg2
import psycopg2.extras
import torch
import open_clip
from PIL import Image

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MODEL_VERSION = "clip-vit-b32-v1"
COOCCURRENCE_THRESHOLD = 0.70   # tag must appear on >=70% of a character's posts
COOCCURRENCE_MIN_POSTS = 5      # ignore characters with fewer posts than this
DEFAULT_CLIP_THRESHOLD = 0.25
DEFAULT_IMAGES_DIR = os.path.expanduser("~/patreon-test/VAMA - VAMA/posts")
DEFAULT_DB_URL = "postgresql:///vamasubmissions_prod"

# Tags that CLIP reliably identifies (avg_rank < 15 in full-corpus validation)
# AND have low false-positive bleed in top-3 validation.
#
# Removed from the original 22-tag list after 50-post validation:
#   futa, ahegao, squirting, milking  — rank high on every post regardless of
#                                       content; pure noise at any top-N cutoff.
#   microkini                         — bleeds onto fully-clothed posts constantly.
#   shower, sauna, bathtub, pool      — cluster with onsen but add only false positives;
#                                       onsen alone is sufficient for the wet/spa cluster.
#
# When --clip-whitelist is active, only these tags are scored by CLIP; everything
# else is handled by title rules and co-occurrence only.  Top-N by rank is used
# instead of a score threshold (scores are flat 0.25–0.31 and unreliable).
CLIP_WHITELIST: list[str] = [
    "onsen", "maid", "christmas", "cow girl", "wet clothes",
    "bunny girl", "nurse", "beach", "swimsuit", "halloween",
    "cheerleader", "classroom", "yukata",
]
CLIP_WHITELIST_TOPN = 3  # pick top-N tags by rank (not by score threshold)


# ---------------------------------------------------------------------------
# DB queries
# ---------------------------------------------------------------------------

def get_posts(
    conn, mode: str, post_id: str | None, include_all: bool, tagged_only: bool = False
) -> list[dict]:
    """Return list of posts to process."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        if mode == "post":
            cur.execute(
                "SELECT id, post_id, title, characters, series, tags "
                "FROM posts WHERE post_id = %s",
                (post_id,)
            )
        elif tagged_only:
            cur.execute(
                "SELECT id, post_id, title, characters, series, tags "
                "FROM posts "
                "WHERE array_length(tags, 1) > 0 "
                "ORDER BY RANDOM()"
            )
        elif include_all:
            cur.execute(
                "SELECT id, post_id, title, characters, series, tags "
                "FROM posts ORDER BY id"
            )
        else:
            # Only posts with no tags
            cur.execute(
                "SELECT id, post_id, title, characters, series, tags "
                "FROM posts "
                "WHERE tags = '{}' OR tags IS NULL "
                "ORDER BY id"
            )
        return cur.fetchall()


def get_tag_vocabulary(conn) -> list[str]:
    """Return all distinct tags used in the DB."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT unnest(tags) AS tag FROM posts "
            "WHERE array_length(tags, 1) > 0 ORDER BY tag"
        )
        return [row[0] for row in cur.fetchall()]


def get_character_tag_cooccurrence(
    conn, threshold: float, min_posts: int = COOCCURRENCE_MIN_POSTS
) -> dict[str, list[tuple[str, float]]]:
    """
    For each character with >= min_posts posts, return tags that appear on
    >= threshold fraction of that character's posts.

    Returns: {character: [(tag, fraction), ...]}
    """
    with conn.cursor() as cur:
        # Count total posts per character (only characters with enough posts)
        cur.execute("""
            SELECT unnest(characters) AS character, COUNT(*) AS total
            FROM posts
            WHERE array_length(characters, 1) > 0
            GROUP BY character
            HAVING COUNT(*) >= %s
        """, (min_posts,))
        char_totals = {row[0]: row[1] for row in cur.fetchall()}

        # Count (character, tag) co-occurrences, excluding null tags.
        # Must unnest characters and tags separately (joined on post id) to avoid
        # PostgreSQL's parallel-unnest padding behaviour when array lengths differ.
        cur.execute("""
            SELECT c.character, t.tag, COUNT(*) AS cnt
            FROM (
                SELECT id, unnest(characters) AS character
                FROM posts
                WHERE array_length(characters, 1) > 0
            ) c
            JOIN (
                SELECT id, unnest(tags) AS tag
                FROM posts
                WHERE array_length(tags, 1) > 0
            ) t ON c.id = t.id
            WHERE t.tag IS NOT NULL
            GROUP BY c.character, t.tag
        """)
        cooc_rows = cur.fetchall()

    result = defaultdict(list)
    for character, tag, cnt in cooc_rows:
        if tag is None:
            continue
        if character not in char_totals:
            continue  # below min_posts threshold
        total = char_totals[character]
        fraction = cnt / total
        if fraction >= threshold:
            result[character].append((tag, fraction))

    return dict(result)


# ---------------------------------------------------------------------------
# Signal 1: Title rules
# ---------------------------------------------------------------------------

# Each entry: (match_fn, [tags_to_suggest])
# match_fn receives the lowercased title and returns True/False
_TITLE_RULES: list[tuple] = [
    (lambda t: "voting winner" in t,  ["voting winner"]),
    (lambda t: "clone" in t,          ["clone"]),
    (lambda t: "manhwa" in t,         ["manhwa"]),
]

def title_rule_suggestions(title: str, characters: list[str], series: list[str]) -> list[dict]:
    suggestions = []
    lowered = title.lower()

    for match_fn, tags in _TITLE_RULES:
        if match_fn(lowered):
            for tag in tags:
                suggestions.append({
                    "tag": tag,
                    "confidence": 1.0,
                    "source": "title_rule",
                })

    # Crossover pairing: 2+ characters from 2+ different series → yuri/lesbian
    if len(characters) >= 2 and len(series) >= 2:
        for tag in ["yuri", "lesbian"]:
            suggestions.append({
                "tag": tag,
                "confidence": 1.0,
                "source": "title_rule",
            })

    return suggestions


# ---------------------------------------------------------------------------
# Signal 2: Character co-occurrence
# ---------------------------------------------------------------------------

def cooccurrence_suggestions(characters: list[str], cooc_cache: dict) -> list[dict]:
    suggestions = []
    for character in characters:
        for tag, fraction in cooc_cache.get(character, []):
            if tag is None:
                continue
            suggestions.append({
                "tag": tag,
                "confidence": round(fraction, 4),
                "source": "char_cooccurrence",
            })
    return suggestions


# ---------------------------------------------------------------------------
# Signal 3: CLIP
# ---------------------------------------------------------------------------

def load_clip_model(device: str):
    """Load CLIP ViT-B/32 via open_clip. Returns (model, preprocess, tokenizer)."""
    print(f"[clip] Loading CLIP ViT-B/32 on {device} ...")
    model, _, preprocess = open_clip.create_model_and_transforms(
        "ViT-B-32", pretrained="openai"
        # Load to CPU first, move explicitly after — avoids ROCm init race
    )
    tokenizer = open_clip.get_tokenizer("ViT-B-32")
    model.eval()
    model.to(device)

    # Warmup pass — forces ROCm to finish kernel init before real inference
    if device != "cpu":
        print(f"[clip] Warming up GPU ...")
        with torch.no_grad():
            dummy_tokens = tokenizer(["warmup"]).to(device)
            _ = model.encode_text(dummy_tokens)
            dummy_img = torch.zeros(1, 3, 224, 224, device=device)
            _ = model.encode_image(dummy_img)
        torch.cuda.synchronize()

    return model, preprocess, tokenizer


def encode_tag_texts(model, tokenizer, tags: list[str], device: str) -> torch.Tensor:
    """Encode all tag names as text embeddings. Returns (N, D) normalized tensor."""
    print(f"[clip] Encoding {len(tags)} tag text embeddings ...")
    # Tokenize on CPU, move result to device (tokenizer itself is CPU-only)
    batch_size = 64
    all_embeddings = []
    with torch.no_grad():
        for i in range(0, len(tags), batch_size):
            batch = tags[i:i + batch_size]
            tokens = tokenizer(batch)          # CPU tensor
            tokens = tokens.to(device)         # move to GPU
            emb = model.encode_text(tokens)
            emb = emb / emb.norm(dim=-1, keepdim=True)
            all_embeddings.append(emb.cpu())
    return torch.cat(all_embeddings, dim=0)  # (N, D)


def find_post_images(images_dir: str, post_id: str) -> list[Path]:
    """
    Find all images for a post. Folder name pattern: '{post_id} - *' or '{post_id}*'.
    Images are in a subdirectory named 'images/'.
    """
    pattern = os.path.join(images_dir, f"{post_id}*", "images", "*.png")
    paths = [Path(p) for p in glob.glob(pattern)]
    # Also try jpg/jpeg/webp
    for ext in ("*.jpg", "*.jpeg", "*.webp"):
        paths += [Path(p) for p in glob.glob(
            os.path.join(images_dir, f"{post_id}*", "images", ext)
        )]
    return paths


def encode_post_images(
    model, preprocess, images: list[Path], device: str, max_images: int = 64
) -> torch.Tensor | None:
    """
    Encode up to max_images images, return their averaged normalized embedding.
    Returns None if no images could be loaded.
    """
    if not images:
        return None

    # Sample evenly if more than max_images
    if len(images) > max_images:
        step = len(images) / max_images
        images = [images[int(i * step)] for i in range(max_images)]

    embeddings = []
    with torch.no_grad():
        for img_path in images:
            try:
                img = preprocess(Image.open(img_path).convert("RGB")).unsqueeze(0).to(device)
                emb = model.encode_image(img)
                emb = emb / emb.norm(dim=-1, keepdim=True)
                embeddings.append(emb.cpu())
            except Exception as e:
                # Skip unreadable images silently
                pass

    if not embeddings:
        return None

    avg = torch.cat(embeddings, dim=0).mean(dim=0)
    avg = avg / avg.norm()
    return avg  # (D,)


def clip_similarities(
    image_embedding: torch.Tensor,
    tags: list[str],
    tag_embeddings: torch.Tensor,
) -> list[tuple[str, float]]:
    """Return all (tag, cosine_sim) pairs sorted by score desc."""
    sims = (tag_embeddings @ image_embedding).tolist()  # (N,)
    return sorted(zip(tags, sims), key=lambda x: -x[1])


def clip_suggestions(
    image_embedding: torch.Tensor,
    tags: list[str],
    tag_embeddings: torch.Tensor,
    threshold: float,
) -> list[dict]:
    """Return tags above threshold as suggestion dicts, sorted by score desc."""
    return [
        {"tag": tag, "confidence": round(sim, 4), "source": "clip"}
        for tag, sim in clip_similarities(image_embedding, tags, tag_embeddings)
        if sim >= threshold
    ]


# ---------------------------------------------------------------------------
# Merge suggestions
# ---------------------------------------------------------------------------

def merge_suggestions(all_suggestions: list[dict]) -> list[dict]:
    """
    Deduplicate by tag, keeping max confidence per tag.
    Returns list sorted by confidence desc.
    """
    best: dict[str, dict] = {}
    for s in all_suggestions:
        tag = s["tag"]
        if tag not in best or s["confidence"] > best[tag]["confidence"]:
            best[tag] = s
    return sorted(best.values(), key=lambda x: x["confidence"], reverse=True)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Generate AI tag suggestions for VAMA posts."
    )
    parser.add_argument(
        "--mode", choices=["batch", "post"], required=True,
        help="'batch' to process multiple posts, 'post' for a single post"
    )
    parser.add_argument(
        "post_id", nargs="?",
        help="Post ID (required when --mode post)"
    )
    parser.add_argument(
        "--all", action="store_true",
        help="Process all posts, not just untagged ones (batch mode only)"
    )
    parser.add_argument(
        "--tagged-only", action="store_true",
        help="Process only already-tagged posts, in random order (useful for validation)"
    )
    parser.add_argument(
        "--db-url", default=DEFAULT_DB_URL,
        help=f"Local DB URL to query (default: {DEFAULT_DB_URL})"
    )
    parser.add_argument(
        "--images-dir", default=DEFAULT_IMAGES_DIR,
        help=f"Root directory containing post image folders (default: {DEFAULT_IMAGES_DIR})"
    )
    parser.add_argument(
        "--output", default="suggestions.json",
        help="Output file for suggestions JSON (default: suggestions.json)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print suggestions to stdout, don't write output file"
    )
    parser.add_argument(
        "--threshold", type=float, default=DEFAULT_CLIP_THRESHOLD,
        help=f"Minimum CLIP cosine similarity to include (default: {DEFAULT_CLIP_THRESHOLD})"
    )
    parser.add_argument(
        "--limit", type=int, default=0,
        help="Max number of posts to process (0 = no limit)"
    )
    parser.add_argument(
        "--no-clip", action="store_true",
        help="Skip CLIP inference (title rules + co-occurrence only)"
    )
    parser.add_argument(
        "--clip-whitelist", action="store_true",
        help=(
            "Restrict CLIP scoring to the CLIP_WHITELIST tags and use top-"
            f"{CLIP_WHITELIST_TOPN} by rank instead of a score threshold. "
            "Tags outside the whitelist are still handled by title rules and "
            "co-occurrence. Recommended over bare --threshold."
        )
    )
    args = parser.parse_args()

    if args.mode == "post" and not args.post_id:
        parser.error("--mode post requires a post_id argument")

    # ------------------------------------------------------------------
    # Step 1: Connect to local DB and load reference data
    # ------------------------------------------------------------------
    print(f"[db] Connecting to {args.db_url} ...")
    try:
        conn = psycopg2.connect(args.db_url)
    except Exception as e:
        print(f"[db] ERROR: Could not connect: {e}", file=sys.stderr)
        print("[db] Hint: run with --sync-db to populate vamasubmissions_prod first.", file=sys.stderr)
        sys.exit(1)

    posts = get_posts(conn, args.mode, args.post_id, args.all, args.tagged_only)
    if not posts:
        print("[db] No posts found matching criteria. Exiting.")
        sys.exit(0)

    if args.limit and args.limit > 0:
        posts = posts[:args.limit]

    print(f"[db] {len(posts)} posts to process.")

    tag_vocab = get_tag_vocabulary(conn)
    print(f"[db] Tag vocabulary: {len(tag_vocab)} tags.")

    print(f"[db] Building character co-occurrence table (threshold={COOCCURRENCE_THRESHOLD}, min_posts={COOCCURRENCE_MIN_POSTS}) ...")
    cooc_cache = get_character_tag_cooccurrence(conn, COOCCURRENCE_THRESHOLD)
    print(f"[db] Co-occurrence cache: {len(cooc_cache)} characters (with >={COOCCURRENCE_MIN_POSTS} posts each).")

    conn.close()

    # ------------------------------------------------------------------
    # Step 2: Load CLIP model and encode tag texts
    # ------------------------------------------------------------------
    if not args.no_clip:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        if device == "cpu":
            print("[clip] WARNING: CUDA not available, running on CPU (will be slow).")
        clip_model, clip_preprocess, clip_tokenizer = load_clip_model(device)

        # When --clip-whitelist is active, only encode/score the reliable tags.
        # Filter to whitelist members that actually exist in the DB vocabulary so
        # the rank table stays consistent even if a tag isn't in the DB yet.
        if args.clip_whitelist:
            active_clip_tags = [t for t in CLIP_WHITELIST if t in tag_vocab]
            missing = [t for t in CLIP_WHITELIST if t not in tag_vocab]
            if missing:
                print(f"[clip] Whitelist tags not in DB vocab (skipping): {missing}")
            print(f"[clip] Whitelist mode: scoring {len(active_clip_tags)} tags "
                  f"(top-{CLIP_WHITELIST_TOPN} by rank).")
        else:
            active_clip_tags = tag_vocab

        tag_embeddings = encode_tag_texts(clip_model, clip_tokenizer, active_clip_tags, device)
    else:
        print("[clip] Skipping CLIP inference (--no-clip).")
        clip_model = clip_preprocess = clip_tokenizer = tag_embeddings = device = None
        active_clip_tags = []

    # ------------------------------------------------------------------
    # Step 3: Process each post
    # ------------------------------------------------------------------
    all_results = []
    ground_truth: dict[str, list[str]] = {}  # post_id → actual tags (for --tagged-only)
    images_dir = os.path.expanduser(args.images_dir)

    # post_id → all CLIP sims (tag, score) sorted desc, unthresholded — for validation display
    all_clip_sims: dict[str, list[tuple[str, float]]] = {}

    for i, post in enumerate(posts):
        post_id = post["post_id"]
        title = post["title"] or ""
        characters = post["characters"] or []
        series = post["series"] or []
        if args.tagged_only:
            ground_truth[post_id] = post["tags"] or []

        print(f"[{i+1}/{len(posts)}] {post_id}  \"{title[:60]}\"", end="", flush=True)

        suggestions = []

        # Signal 1: title rules
        suggestions.extend(title_rule_suggestions(title, characters, series))

        # Signal 2: character co-occurrence
        suggestions.extend(cooccurrence_suggestions(characters, cooc_cache))

        # Signal 3: CLIP
        if not args.no_clip:
            images = find_post_images(images_dir, post_id)
            if images:
                img_emb = encode_post_images(clip_model, clip_preprocess, images, device)
                if img_emb is not None:
                    sims = clip_similarities(img_emb, active_clip_tags, tag_embeddings)
                    all_clip_sims[post_id] = sims  # unthresholded, for validation display
                    if args.clip_whitelist:
                        # Top-N by rank — score threshold is unreliable in whitelist mode
                        clip_sugs = [
                            {"tag": t, "confidence": round(s, 4), "source": "clip"}
                            for t, s in sims[:CLIP_WHITELIST_TOPN]
                        ]
                    else:
                        clip_sugs = [
                            {"tag": t, "confidence": round(s, 4), "source": "clip"}
                            for t, s in sims if s >= args.threshold
                        ]
                    suggestions.extend(clip_sugs)

        # Merge
        merged = merge_suggestions(suggestions)
        print(f"  → {len(merged)} suggestions")

        for s in merged:
            all_results.append({
                "post_id": post_id,
                "tag": s["tag"],
                "confidence": s["confidence"],
                "source": s["source"],
                "model_version": MODEL_VERSION if s["source"] == "clip" else None,
            })

    # ------------------------------------------------------------------
    # Step 4: Output
    # ------------------------------------------------------------------
    print(f"\n[done] {len(all_results)} total suggestions across {len(posts)} posts.")

    if args.dry_run:
        print("\n--- DRY RUN (not written to file) ---")
        by_post = defaultdict(list)
        for r in all_results:
            by_post[r["post_id"]].append(r)

        # Include posts with no suggestions in validation mode
        all_post_ids = [p["post_id"] for p in posts]

        for post in posts:
            post_id = post["post_id"]
            title = (post["title"] or "")[:60]
            sugs = by_post.get(post_id, [])
            actual = ground_truth.get(post_id, [])
            suggested_tags = {s["tag"] for s in sugs}

            if args.tagged_only:
                hits = sorted(suggested_tags & set(actual))
                misses = sorted(set(actual) - suggested_tags)
                false_pos = sorted(suggested_tags - set(actual))
                # Top CLIP scores for actual tags (regardless of threshold)
                clip_sims = {t: c for t, c in all_clip_sims.get(post_id, [])}
                actual_clip = sorted(
                    [(t, clip_sims.get(t, 0.0)) for t in actual],
                    key=lambda x: -x[1]
                )
                print(f"\n  \"{title}\"")
                print(f"  actual:      {actual}")
                print(f"  hits:        {hits}")
                print(f"  misses:      {misses}")
                if false_pos:
                    print(f"  false pos:   {false_pos}")
                if actual_clip:
                    scores_str = "  ".join(f"{t}({s:.2f})" for t, s in actual_clip)
                    print(f"  clip@actual: {scores_str}")
                if not args.no_clip:
                    top_clip = all_clip_sims.get(post_id, [])[:8]
                    top_str = "  ".join(f"{t}({s:.2f})" for t, s in top_clip)
                    print(f"  clip top8:   {top_str}")
            else:
                print(f"\n  \"{title}\"  ({post_id})")
                for s in sugs:
                    src = s["source"][:4]
                    print(f"    {str(s['tag']):<28} {s['confidence']:.3f}  [{src}]")

        # ------------------------------------------------------------------
        # Aggregate stats (--tagged-only only, requires CLIP data)
        # ------------------------------------------------------------------
        if args.tagged_only and not args.no_clip:
            # Only include posts that have CLIP data
            clip_posts = [p for p in posts if p["post_id"] in all_clip_sims]
            n_clip = len(clip_posts)

            if n_clip == 0:
                print("\n[stats] No CLIP data available for aggregate stats.")
            else:
                # Build per-post rank lookup: tag -> rank (0-indexed) for each post
                # all_clip_sims[post_id] is already sorted desc by score
                rank_lookup: dict[str, dict[str, int]] = {}
                for p in clip_posts:
                    pid = p["post_id"]
                    rank_lookup[pid] = {tag: i for i, (tag, _) in enumerate(all_clip_sims[pid])}

                # Table 1: Top-N coverage
                top_ns = [1, 2, 3, 5, 8, 10, 15, 20]
                print(f"\n--- Aggregate CLIP stats ({n_clip} posts with images) ---")
                print(f"\n {'N':>3}   {'all covered':>20}   {'any covered':>20}")
                print(f" {'---':>3}   {'------------':>20}   {'------------':>20}")
                for n in top_ns:
                    all_covered = 0
                    any_covered = 0
                    for p in clip_posts:
                        pid = p["post_id"]
                        actual = ground_truth.get(pid, [])
                        if not actual:
                            continue
                        ranks = rank_lookup[pid]
                        in_topn = {tag for tag, r in ranks.items() if r < n}
                        actual_set = set(actual)
                        if actual_set <= in_topn:
                            all_covered += 1
                        if actual_set & in_topn:
                            any_covered += 1
                    print(
                        f" {n:>3}   "
                        f"{all_covered:>4} / {n_clip:<4} ({100*all_covered/n_clip:5.1f}%)   "
                        f"{any_covered:>4} / {n_clip:<4} ({100*any_covered/n_clip:5.1f}%)"
                    )

                # Table 2: Per-tag discoverability
                # Collect stats for every tag that appears in ground truth across all posts
                tag_appearances: Counter = Counter()
                tag_ranks: dict[str, list[int]] = defaultdict(list)
                tag_scores: dict[str, list[float]] = defaultdict(list)

                for p in clip_posts:
                    pid = p["post_id"]
                    actual = ground_truth.get(pid, [])
                    ranks = rank_lookup[pid]
                    score_lookup = {tag: score for tag, score in all_clip_sims[pid]}
                    for tag in actual:
                        tag_appearances[tag] += 1
                        if tag in ranks:
                            tag_ranks[tag].append(ranks[tag])
                            tag_scores[tag].append(score_lookup[tag])

                # Sort by avg rank ascending (most discoverable first)
                all_seen_tags = sorted(
                    tag_appearances.keys(),
                    key=lambda t: (
                        sum(tag_ranks[t]) / len(tag_ranks[t]) if tag_ranks[t] else 9999
                    )
                )

                print(f"\n--- Per-tag CLIP discoverability ---")
                print(f"\n  {'tag':<28}  {'n':>3}  {'avg_rank':>8}  {'avg_score':>9}  {'in_top5':>7}  {'in_top10':>8}")
                print(f"  {'-'*28}  {'---':>3}  {'--------':>8}  {'---------':>9}  {'-------':>7}  {'--------':>8}")
                for tag in all_seen_tags:
                    n_app = tag_appearances[tag]
                    rs = tag_ranks.get(tag, [])
                    ss = tag_scores.get(tag, [])
                    avg_rank = sum(rs) / len(rs) if rs else float("nan")
                    avg_score = sum(ss) / len(ss) if ss else float("nan")
                    in_top5 = sum(1 for r in rs if r < 5)
                    in_top10 = sum(1 for r in rs if r < 10)
                    print(
                        f"  {tag:<28}  {n_app:>3}  {avg_rank:>8.1f}  {avg_score:>9.3f}"
                        f"  {in_top5:>3}/{n_app:<3}  {in_top10:>4}/{n_app}"
                    )

    else:
        out_path = Path(args.output)
        with open(out_path, "w") as f:
            json.dump(all_results, f, indent=2)
        print(f"[done] Written to {out_path} ({out_path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
