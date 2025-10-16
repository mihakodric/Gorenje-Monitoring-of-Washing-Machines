"""
Test modular models structure.
"""

import os
import sys

def test_modular_models():
    """Test that all modular models can be imported correctly."""
    print("🧪 Testing modular models structure...")
    print("=" * 50)
    
    # Test individual model imports
    model_tests = [
        ("SensorType models", "from app.models.sensor_types import SensorType, SensorTypeCreate, SensorTypeUpdate"),
        ("Sensor models", "from app.models.sensors import Sensor, SensorCreate, SensorUpdate"),
        ("Machine models", "from app.models.machines import Machine, MachineCreate, MachineUpdate"),
        ("MachineType models", "from app.models.machine_types import MachineType, MachineTypeCreate, MachineTypeUpdate"),
        ("Test models", "from app.models.tests import Test, TestCreate, TestWithRelations"),
        ("Measurement models", "from app.models.measurements import Measurement"),
        ("MQTT models", "from app.models.mqtt import MqttConfig, MqttConfigUpdate")
    ]
    
    for test_name, import_statement in model_tests:
        try:
            exec(import_statement)
            print(f"   ✅ {test_name}")
        except ImportError as e:
            print(f"   ❌ {test_name}: {e}")
            return False
    
    # Test unified imports from __init__.py
    print(f"\n📦 Testing unified model imports...")
    try:
        from app.models import (
            SensorType, Sensor, Machine, MachineType,
            Test, Measurement, MqttConfig
        )
        print("   ✅ Unified model imports working")
    except ImportError as e:
        print(f"   ❌ Unified imports failed: {e}")
        return False
    
    # Check file structure
    print(f"\n📁 Checking modular file structure...")
    required_files = [
        "app/models/__init__.py",
        "app/models/sensor_types.py",
        "app/models/sensors.py",
        "app/models/machines.py", 
        "app/models/machine_types.py",
        "app/models/tests.py",
        "app/models/measurements.py",
        "app/models/mqtt.py"
    ]
    
    all_files_exist = True
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"   ✅ {file_path}")
        else:
            print(f"   ❌ {file_path}")
            all_files_exist = False
    
    return all_files_exist

if __name__ == "__main__":
    print("🔧 Testing Gorenje API modular models...")
    
    success = test_modular_models()
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 Modular models test PASSED!")
        print("\n📋 Benefits of modular structure:")
        print("   • Better code organization")
        print("   • Easier maintenance and debugging")
        print("   • Clear separation of concerns")
        print("   • Improved reusability")
        print("   • Follows FastAPI best practices")
    else:
        print("❌ Modular models test FAILED!")
        print("   Check the error messages above for details.")