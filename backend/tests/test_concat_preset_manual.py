"""
Manual test script for concat preset endpoints.
Run this after starting the backend server to verify endpoints work.

Usage:
    python backend/tests/test_concat_preset_manual.py
"""

import requests
import json

BASE_URL = "http://localhost:8000/api/v1/settings"


def test_concat_presets():
    print("Testing Concat Preset Endpoints...")
    print("=" * 50)
    
    # Test 1: List presets (should be empty initially)
    print("\n1. GET /concat-presets (list)")
    response = requests.get(f"{BASE_URL}/concat-presets")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {json.dumps(response.json(), indent=2)}")
    
    # Test 2: Create a preset
    print("\n2. POST /concat-presets (create)")
    preset_data = {
        "name": "Test Preset",
        "description": "High quality 1080p concat",
        "transition_type": "crossfade",
        "transition_duration": 1.5,
        "resolution": "1080p",
        "quality": "high",
        "mute_original_audio": False,
        "enable_audio_fade": True,
        "audio_fade_duration": 2.0,
        "background_music_volume": 50
    }
    response = requests.post(f"{BASE_URL}/concat-presets", json=preset_data)
    print(f"   Status: {response.status_code}")
    print(f"   Response: {json.dumps(response.json(), indent=2)}")
    
    # Test 3: List presets again (should have 1 preset)
    print("\n3. GET /concat-presets (list after create)")
    response = requests.get(f"{BASE_URL}/concat-presets")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {json.dumps(response.json(), indent=2)}")
    
    # Test 4: Update the preset
    print("\n4. PUT /concat-presets/Test Preset (update)")
    updated_data = {
        "name": "Test Preset",
        "description": "Updated description",
        "transition_type": "dip_to_black",
        "transition_duration": 2.0,
        "resolution": "720p",
        "quality": "medium",
        "mute_original_audio": True,
        "enable_audio_fade": False,
        "audio_fade_duration": 1.5,
        "background_music_volume": 75
    }
    response = requests.put(f"{BASE_URL}/concat-presets/Test Preset", json=updated_data)
    print(f"   Status: {response.status_code}")
    print(f"   Response: {json.dumps(response.json(), indent=2)}")
    
    # Test 5: List presets to verify update
    print("\n5. GET /concat-presets (list after update)")
    response = requests.get(f"{BASE_URL}/concat-presets")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {json.dumps(response.json(), indent=2)}")
    
    # Test 6: Delete the preset
    print("\n6. DELETE /concat-presets/Test Preset (delete)")
    response = requests.delete(f"{BASE_URL}/concat-presets/Test Preset")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {json.dumps(response.json(), indent=2)}")
    
    # Test 7: List presets (should be empty again)
    print("\n7. GET /concat-presets (list after delete)")
    response = requests.get(f"{BASE_URL}/concat-presets")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {json.dumps(response.json(), indent=2)}")
    
    print("\n" + "=" * 50)
    print("All tests completed!")


if __name__ == "__main__":
    try:
        test_concat_presets()
    except requests.exceptions.ConnectionError:
        print("ERROR: Could not connect to backend server.")
        print("Please start the backend server first:")
        print("  python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000")
    except Exception as e:
        print(f"ERROR: {e}")
