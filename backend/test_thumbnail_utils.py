"""
Quick test script for thumbnail_utils functions.
"""

from app.utils.thumbnail_utils import (
    generate_thumbnail_filename,
    get_file_extension,
    build_thumbnail_url,
    extract_post_id_from_thumbnail_filename,
    extract_ordinal_from_thumbnail_filename,
)


def test_generate_thumbnail_filename():
    print("\n=== Testing generate_thumbnail_filename ===")
    
    filename1 = generate_thumbnail_filename("129090487", 0, "png")
    print(f"Post 129090487, ordinal 0, png: {filename1}")
    assert filename1.startswith("129090487-t-000-")
    assert filename1.endswith(".png")
    assert len(filename1.split("-")[-1].split(".")[0]) == 8  # UUID is 8 chars
    
    filename2 = generate_thumbnail_filename("123", 25, "webp")
    print(f"Post 123, ordinal 25, webp: {filename2}")
    assert filename2.startswith("123-t-025-")
    assert filename2.endswith(".webp")
    
    print("✓ All tests passed")


def test_get_file_extension():
    print("\n=== Testing get_file_extension ===")
    
    assert get_file_extension("image.png") == "png"
    assert get_file_extension("photo.JPEG") == "jpeg"
    assert get_file_extension("file.WebP") == "webp"
    assert get_file_extension("file") == ""
    
    print("✓ All tests passed")


def test_build_thumbnail_url():
    print("\n=== Testing build_thumbnail_url ===")
    
    url = build_thumbnail_url("129090487-t-000-a1b2c3d4.png")
    print(f"URL: {url}")
    assert url == "https://vamarequests.com/static/thumbnails/129090487-t-000-a1b2c3d4.png"
    
    print("✓ All tests passed")


def test_extract_post_id_from_thumbnail_filename():
    print("\n=== Testing extract_post_id_from_thumbnail_filename ===")
    
    post_id1 = extract_post_id_from_thumbnail_filename("129090487-t-000-a1b2c3d4.png")
    print(f"'129090487-t-000-a1b2c3d4.png' -> {post_id1}")
    assert post_id1 == "129090487"
    
    post_id2 = extract_post_id_from_thumbnail_filename("invalid.png")
    print(f"'invalid.png' -> {post_id2}")
    assert post_id2 is None
    
    print("✓ All tests passed")


def test_extract_ordinal_from_thumbnail_filename():
    print("\n=== Testing extract_ordinal_from_thumbnail_filename ===")
    
    ordinal1 = extract_ordinal_from_thumbnail_filename("129090487-t-000-a1b2c3d4.png")
    print(f"'129090487-t-000-a1b2c3d4.png' -> {ordinal1}")
    assert ordinal1 == 0
    
    ordinal2 = extract_ordinal_from_thumbnail_filename("129090487-t-025-b2c3d4e5.png")
    print(f"'129090487-t-025-b2c3d4e5.png' -> {ordinal2}")
    assert ordinal2 == 25
    
    ordinal3 = extract_ordinal_from_thumbnail_filename("invalid.png")
    print(f"'invalid.png' -> {ordinal3}")
    assert ordinal3 is None
    
    print("✓ All tests passed")


if __name__ == "__main__":
    print("Testing thumbnail_utils...")
    
    test_generate_thumbnail_filename()
    test_get_file_extension()
    test_build_thumbnail_url()
    test_extract_post_id_from_thumbnail_filename()
    test_extract_ordinal_from_thumbnail_filename()
    
    print("\n" + "="*50)
    print("✓ ALL TESTS PASSED!")
    print("="*50)
