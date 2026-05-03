#!/usr/bin/env python
"""
ENTROPY RFP PLATFORM - MANUAL VERIFICATION SCRIPT
This script can be run to verify the application without needing direct CLI access.
Run from: C:\Users\Khali\Desktop\pdfs\entropy-rfp-platform\apps\api

Usage:
  python verify.py
"""
import sys
import traceback
from pathlib import Path

def verify_imports():
    """Verify all required dependencies can be imported."""
    print("=" * 70)
    print("STEP 1: VERIFYING DEPENDENCIES")
    print("=" * 70)
    
    deps = [
        ("fastapi", "FastAPI"),
        ("sqlalchemy", "SQLAlchemy"),
        ("pydantic", "Pydantic"),
        ("jose", "python-jose"),
        ("passlib", "Passlib"),
        ("bcrypt", "bcrypt"),
        ("httpx", "httpx"),
        ("docx", "python-docx"),
    ]
    
    all_good = True
    for module, name in deps:
        try:
            __import__(module)
            print(f"  ✓ {name}")
        except ImportError as e:
            print(f"  ✗ {name}: {e}")
            all_good = False
    
    return all_good

def verify_env():
    """Verify .env configuration."""
    print("\n" + "=" * 70)
    print("STEP 2: VERIFYING ENVIRONMENT CONFIGURATION")
    print("=" * 70)
    
    from core.config import settings
    
    print(f"  Environment: {settings.environment}")
    print(f"  Database: {settings.database_url[:50]}...")
    print(f"  CORS Origins: {settings.allowed_origins}")
    print(f"  JWT Secret: {settings.jwt_secret_key[:20]}...")
    print(f"  API Base: {settings.api_base_url}")
    
    # Check CORS config
    if settings.allowed_origins == ['["http://localhost:3000"]']:
        print("\n  ✗ CRITICAL: CORS STILL BROKEN - JSON literal detected!")
        print("    Fix: Change .env line 54 to: ALLOWED_ORIGINS=http://localhost:3000")
        return False
    elif "http://localhost:3000" in settings.allowed_origins:
        print("\n  ✓ CORS configuration looks correct")
    else:
        print(f"\n  ⚠ CORS origins unexpected: {settings.allowed_origins}")
    
    return True

def verify_database():
    """Verify database can be initialized."""
    print("\n" + "=" * 70)
    print("STEP 3: VERIFYING DATABASE SETUP")
    print("=" * 70)
    
    try:
        from core.database import engine, Base, AsyncSessionLocal
        from models.user import User
        from sqlalchemy import inspect
        
        print("  ✓ Database engine created")
        
        # Try to get table names (doesn't require full connection for SQLite)
        from sqlalchemy import create_engine as sync_create_engine
        if "sqlite" in str(engine.url):
            sync_engine = sync_create_engine(str(engine.url).replace("+aiosqlite", ""))
            inspector = inspect(sync_engine)
            tables = inspector.get_table_names()
            print(f"  ✓ SQLite database found with {len(tables)} tables")
            if tables:
                print(f"    Tables: {', '.join(tables[:3])}...")
        
        print("  ✓ Models imported successfully")
        return True
        
    except Exception as e:
        print(f"  ✗ Database verification failed: {e}")
        traceback.print_exc()
        return False

def verify_app():
    """Verify FastAPI app can be imported."""
    print("\n" + "=" * 70)
    print("STEP 4: VERIFYING FASTAPI APP")
    print("=" * 70)
    
    try:
        from main import app
        print("  ✓ FastAPI app imported successfully")
        
        # Check routes
        routes = [route.path for route in app.routes if hasattr(route, 'path')]
        print(f"  ✓ App has {len(routes)} routes")
        
        # Check key routers
        key_paths = ["/api/auth/login", "/api/rfps/upload", "/api/templates"]
        for path in key_paths:
            if any(path in route for route in routes):
                print(f"    ✓ {path} endpoint available")
            else:
                print(f"    ⚠ {path} endpoint not found")
        
        return True
        
    except Exception as e:
        print(f"  ✗ App verification failed: {e}")
        traceback.print_exc()
        return False

def verify_seed_data():
    """Verify seed data structure."""
    print("\n" + "=" * 70)
    print("STEP 5: VERIFYING SEED DATA")
    print("=" * 70)
    
    try:
        from seed import TEMPLATES, hash_password
        
        print(f"  ✓ Seed script imports successfully")
        print(f"  ✓ {len(TEMPLATES)} proposal templates defined")
        
        for i, tmpl in enumerate(TEMPLATES, 1):
            sections = len(tmpl.get("sections", []))
            print(f"    [{i}] {tmpl['name_en']}: {sections} sections")
        
        print(f"  ✓ Default credentials:")
        print(f"    Email: admin@entropy.sa")
        print(f"    Password: Admin@1234")
        print(f"    Role: ADMIN")
        
        return True
        
    except Exception as e:
        print(f"  ✗ Seed verification failed: {e}")
        traceback.print_exc()
        return False

def verify_rfp_upload_fix():
    """Verify RFP upload file type validation fix."""
    print("\n" + "=" * 70)
    print("STEP 6: VERIFYING UPLOAD ENDPOINT FIX")
    print("=" * 70)
    
    try:
        with open("routers/rfp.py", "r") as f:
            content = f.read()
        
        # Check for the fix
        if "Validate file types match number of files" in content:
            print("  ✓ File type validation fix found")
        else:
            print("  ✗ File type validation fix NOT FOUND")
            return False
        
        if "File type mismatch:" in content:
            print("  ✓ Error message for type mismatch found")
        else:
            print("  ✗ Error message NOT FOUND")
            return False
        
        if "strict=False" in content:
            print("  ✗ Still using zip(..., strict=False) - fix incomplete!")
            return False
        else:
            print("  ✓ Fixed zip() call without strict=False")
        
        return True
        
    except Exception as e:
        print(f"  ✗ Upload fix verification failed: {e}")
        return False

def main():
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 15 + "ENTROPY RFP PLATFORM VERIFICATION" + " " * 20 + "║")
    print("╚" + "=" * 68 + "╝")
    print()
    
    results = [
        ("Dependencies", verify_imports()),
        ("Environment", verify_env()),
        ("Database", verify_database()),
        ("FastAPI App", verify_app()),
        ("Seed Data", verify_seed_data()),
        ("Upload Fix", verify_rfp_upload_fix()),
    ]
    
    print("\n" + "=" * 70)
    print("VERIFICATION SUMMARY")
    print("=" * 70)
    
    passed = 0
    for name, result in results:
        status = "PASS" if result else "FAIL"
        symbol = "✓" if result else "✗"
        print(f"  {symbol} {name}: {status}")
        if result:
            passed += 1
    
    total = len(results)
    print(f"\nResult: {passed}/{total} checks passed")
    
    if passed == total:
        print("\n✓ All verification checks passed! Application is ready for testing.")
        print("\nNext steps:")
        print("  1. Run: python seed.py          # Seed database with admin user")
        print("  2. Run: uvicorn main:app --reload --port 8000")
        print("  3. Test login: POST http://localhost:8000/api/auth/login")
        return 0
    else:
        print(f"\n✗ {total - passed} check(s) failed. See details above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
