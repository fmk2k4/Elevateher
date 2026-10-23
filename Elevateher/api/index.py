import sys
import os
from pathlib import Path

# Add the root directory to the python path so that services module can be imported
sys.path.append(str(Path(__file__).parent.parent))
# Add the services directory
sys.path.append(str(Path(__file__).parent.parent / "services"))
# Add the api directory
sys.path.append(str(Path(__file__).parent.parent / "services" / "api"))

# Set VERCEL env var to trigger our fallback code
os.environ["VERCEL"] = "1"

from services.api.main import app
