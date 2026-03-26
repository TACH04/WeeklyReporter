import sys
import os
sys.path.append(os.getcwd())
from automation.submitter import QuestionProSubmitter

def test_automator():
    print("Testing QuestionProSubmitter...")
    try:
        submitter = QuestionProSubmitter(headless=False)
        print("Submitter initialized successfully.")
        # Try to open the URL
        submitter.driver.get(submitter.url)
        print(f"Successfully opened: {submitter.url}")
        import time
        time.sleep(5)
        submitter.close()
        print("Submitter closed successfully.")
    except Exception as e:
        print(f"FAILED to initialize or run submitter: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_automator()
