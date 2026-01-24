#!/bin/bash

# Download Square Thumbnails for VAMA Posts
# This script downloads only the square thumbnails from Patreon posts
# Usage: ./download_thumbnails.sh

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

# Paths
POSTS_DIR="$HOME/patreon-test/VAMA - VAMA/posts"
THUMBNAILS_DIR="$HOME/patreon-test/all-thumbnails"
PATREON_DL_CONFIG="$HOME/patreon-test/vama_thumbnails.conf"
TEMP_DIR="$HOME/patreon-test/.thumbnail_temp"

# Log file
LOG_FILE="$HOME/patreon-test/download_thumbnails.log"

# Parallel processing settings
MAX_PARALLEL_JOBS=10
MIN_POSTS_FOR_PARALLEL=100

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# ============================================================================
# PROCESSING FUNCTION (called per post)
# ============================================================================

process_post() {
    local post_id="$1"
    local log_prefix="[Post $post_id]"
    
    # Check if thumbnail already exists (shouldn't happen, but double-check)
    local thumbnail_file="$THUMBNAILS_DIR/${post_id}-thumbnail-square.webp"
    if [ -f "$thumbnail_file" ]; then
        echo "$log_prefix Thumbnail already exists (skipped in scan)" >> "$LOG_FILE"
        return 0
    fi
    
    # Always download fresh post info to get valid URLs
    local post_url="https://www.patreon.com/posts/${post_id}"
    local temp_post_dir="$TEMP_DIR/post_${post_id}"
    
    mkdir -p "$temp_post_dir"
    
    # Run patreon-dl to download only post info
    if ! patreon-dl -y -C "$PATREON_DL_CONFIG" -o "$temp_post_dir" "$post_url" >> "$LOG_FILE" 2>&1; then
        echo "$log_prefix [ERROR] Failed to download post info" >> "$LOG_FILE"
        rm -rf "$temp_post_dir"
        return 1
    fi
    
    # Find the post-api.json file
    local post_api_json=$(find "$temp_post_dir" -name "post-api.json" | head -1)
    
    if [ -z "$post_api_json" ] || [ ! -f "$post_api_json" ]; then
        echo "$log_prefix [ERROR] post-api.json not found" >> "$LOG_FILE"
        rm -rf "$temp_post_dir"
        return 1
    fi
    
    # Extract thumbnail URL from JSON
    local thumb_url=$(jq -r '.data.attributes.image.thumb_square_url // empty' "$post_api_json")
    
    if [ -z "$thumb_url" ] || [ "$thumb_url" = "null" ]; then
        echo "$log_prefix [ERROR] No thumbnail URL found in post-api.json" >> "$LOG_FILE"
        rm -rf "$temp_post_dir"
        return 1
    fi
    
    # Download thumbnail
    if curl -s -o "$thumbnail_file" "$thumb_url"; then
        echo "$log_prefix [SUCCESS] Downloaded ${post_id}-thumbnail-square.webp" >> "$LOG_FILE"
        rm -rf "$temp_post_dir"
        return 0
    else
        echo "$log_prefix [ERROR] Failed to download thumbnail" >> "$LOG_FILE"
        rm -rf "$temp_post_dir"
        return 1
    fi
}

# Export function for parallel to use
export -f process_post
export THUMBNAILS_DIR PATREON_DL_CONFIG TEMP_DIR LOG_FILE

# ============================================================================
# MAIN SCRIPT
# ============================================================================

main() {
    log "========================================="
    log "Starting thumbnail download process"
    log "========================================="
    
    # Create directories
    mkdir -p "$THUMBNAILS_DIR"
    mkdir -p "$TEMP_DIR"
    
    # Check if patreon-dl config exists
    if [ ! -f "$PATREON_DL_CONFIG" ]; then
        print_error "Patreon-dl config not found: $PATREON_DL_CONFIG"
        print_info "Please create a config file that downloads only post info (no media)"
        exit 1
    fi
    
    # Check if posts directory exists
    if [ ! -d "$POSTS_DIR" ]; then
        print_error "Posts directory not found: $POSTS_DIR"
        exit 1
    fi
    
    # Check if GNU parallel is installed
    if ! command -v parallel &> /dev/null; then
        print_error "GNU parallel is not installed"
        print_info "Install with: brew install parallel"
        exit 1
    fi
    
    print_info "Scanning for posts and existing thumbnails..."
    
    # Step 1: Scan all post folders and build list of IDs to process
    local -a post_ids_to_process=()
    local total_posts=0
    local already_exist=0
    
    for post_folder in "$POSTS_DIR"/*; do
        if [ ! -d "$post_folder" ]; then
            continue
        fi
        
        # Extract post ID from folder name (format: "postid - title")
        local folder_name=$(basename "$post_folder")
        local post_id=$(echo "$folder_name" | sed -E 's/^([0-9]+) - .*/\1/')
        
        # Validate post ID
        if ! [[ "$post_id" =~ ^[0-9]+$ ]]; then
            log "[WARNING] Invalid post ID extracted from: $folder_name"
            continue
        fi
        
        total_posts=$((total_posts + 1))
        
        # Check if thumbnail already exists
        local thumbnail_file="$THUMBNAILS_DIR/${post_id}-thumbnail-square.webp"
        if [ -f "$thumbnail_file" ]; then
            already_exist=$((already_exist + 1))
        else
            post_ids_to_process+=("$post_id")
        fi
    done
    
    local to_process=${#post_ids_to_process[@]}
    
    print_info "Scan complete:"
    print_info "  Total posts found: $total_posts"
    print_info "  Already have thumbnails: $already_exist"
    print_info "  Need to download: $to_process"
    
    if [ $to_process -eq 0 ]; then
        print_success "All thumbnails already exist!"
        rm -rf "$TEMP_DIR"
        return 0
    fi
    
    # Step 2: Decide whether to use parallel processing
    local use_parallel=false
    if [ $to_process -ge $MIN_POSTS_FOR_PARALLEL ]; then
        use_parallel=true
        print_info "Using parallel processing ($MAX_PARALLEL_JOBS jobs)"
    else
        print_info "Using sequential processing (< $MIN_POSTS_FOR_PARALLEL posts)"
    fi
    
    echo ""
    log "Starting download of $to_process thumbnails..."
    
    # Step 3: Process the posts
    if [ "$use_parallel" = true ]; then
        # Use GNU parallel
        printf '%s\n' "${post_ids_to_process[@]}" | \
            parallel --bar --jobs "$MAX_PARALLEL_JOBS" process_post {}
    else
        # Sequential processing
        local count=0
        for post_id in "${post_ids_to_process[@]}"; do
            count=$((count + 1))
            print_info "[$count/$to_process] Processing post: $post_id"
            process_post "$post_id"
        done
    fi
    
    # Step 4: Count results
    local downloaded_count=0
    local failed_count=0
    
    for post_id in "${post_ids_to_process[@]}"; do
        if [ -f "$THUMBNAILS_DIR/${post_id}-thumbnail-square.webp" ]; then
            downloaded_count=$((downloaded_count + 1))
        else
            failed_count=$((failed_count + 1))
        fi
    done
    
    # Summary
    echo ""
    log "========================================="
    log "THUMBNAIL DOWNLOAD COMPLETE"
    log "========================================="
    log "Total posts found: $total_posts"
    log "Already existed: $already_exist"
    log "Newly downloaded: $downloaded_count"
    log "Failed: $failed_count"
    log "Thumbnails directory: $THUMBNAILS_DIR"
    
    # Clean up temp directory
    rm -rf "$TEMP_DIR"
    
    if [ $failed_count -eq 0 ]; then
        print_success "All thumbnails processed successfully!"
        return 0
    else
        print_error "Some thumbnails failed to download. Check log: $LOG_FILE"
        return 1
    fi
}

# Run main function
main "$@"
