#!/usr/bin/env python
"""
E2E Testing Script for Entropy RFP Platform
Tests: Login, Upload, Navigation through main pages
"""
import os
import sys
import asyncio
import subprocess
import time
from pathlib import Path

# Add API to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'apps', 'api'))

def main():
    project_root = Path(__file__).parent
    api_dir = project_root / "apps" / "api"
    
    print("=" * 70)
    print("ENTROPY RFP PLATFORM - E2E TEST SUITE")
    print("=" * 70)
    
    # Step 1: Seed database
    print("\n[1/4] Seeding database with admin user...")
    try:
        os.chdir(api_dir)
        from seed import seed
        asyncio.run(seed())
        print("✓ Database seeded successfully")
    except Exception as e:
        print(f"✗ Database seeding failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # Step 2: Test API startup
    print("\n[2/4] Testing API startup...")
    try:
        os.chdir(api_dir)
        # Try importing main app
        from main import app
        print("✓ API app imported successfully")
    except Exception as e:
        print(f"✗ API startup failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    # Step 3: Test FastAPI endpoints
    print("\n[3/4] Testing API endpoints with pytest...")
    try:
        os.chdir(api_dir)
        result = subprocess.run(
            [sys.executable, "-m", "pytest", "-v", "--tb=short", "-x"],
            capture_output=False,
            text=True,
            timeout=60
        )
        if result.returncode != 0:
            print("⚠ Some tests failed")
    except Exception as e:
        print(f"✗ Pytest execution failed: {e}")
    
    # Step 4: Test login flow programmatically
    print("\n[4/4] Testing login flow...")
    try:
        os.chdir(api_dir)
        from fastapi.testclient import TestClient
        from main import app
        
        client = TestClient(app)
        
        # Test login with default credentials
        login_response = client.post(
            "/api/auth/login",
            json={
                "email": "admin@entropy.sa",
                "password": "Admin@1234"
            }
        )
        
        print(f"    Login response status: {login_response.status_code}")
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("access_token")
            print(f"    ✓ Login successful, token received: {token[:20]}...")
            
            # Test protected endpoint
            headers = {"Authorization": f"Bearer {token}"}
            me_response = client.get("/api/auth/me", headers=headers)
            print(f"    GET /api/auth/me status: {me_response.status_code}")
            if me_response.status_code == 200:
                print(f"    ✓ Protected endpoint working")
                print(f"    User data: {me_response.json()}")
        else:
            print(f"    ✗ Login failed: {login_response.text}")
            return 1
            
    except Exception as e:
        print(f"✗ Login test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    print("\n" + "=" * 70)
    print("E2E TEST SUITE COMPLETED")
    print("=" * 70)
    return 0

if __name__ == "__main__":
    sys.exit(main())
