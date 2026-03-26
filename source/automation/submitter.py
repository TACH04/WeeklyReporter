from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import time
import subprocess
import platform
import os

class QuestionProSubmitter:
    def __init__(self, headless=False, url="https://asu.questionpro.com/t/AXETTZ7wuY"):
        chrome_options = Options()
        if headless:
            chrome_options.add_argument("--headless")
        
        driver_path = ChromeDriverManager().install()
        
        # macOS ARM64 fix: re-sign the binary if it has an invalid signature
        if platform.system() == "Darwin":
            print(f"Checking ChromeDriver signature at: {driver_path}")
            try:
                # Remove quarantine and re-sign
                subprocess.run(["xattr", "-cr", driver_path], check=False)
                subprocess.run(["codesign", "--force", "--deep", "--sign", "-", driver_path], check=True, capture_output=True)
                print("ChromeDriver re-signed successfully.")
            except Exception as e:
                print(f"Warning: Failed to re-sign ChromeDriver: {e}")

        self.driver = webdriver.Chrome(service=Service(driver_path), options=chrome_options)
        self.url = url

    def fill_report(self, asu_id, interactions, feedback):
        """
        interactions: list of dicts [{"asu_id": "...", "summary": "..."}]
        feedback: dict with keys "recognition", "concerns", "trends", "assistance"
        """
        self.driver.get(self.url)
        wait = WebDriverWait(self.driver, 10)

        # Page 1: ASU ID
        try:
            # Try specific current known ID
            try:
                id_field = wait.until(EC.element_to_be_clickable((By.ID, "834450353ID")))
            except:
                id_field = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "input.number-input, input[type='text'], input[type='tel']")))
                
            id_field.clear()
            id_field.send_keys(asu_id)
            
            # Click Start Button - verified ID is SurveySubmitButtonElement
            start_btn = wait.until(EC.element_to_be_clickable((By.ID, "SurveySubmitButtonElement")))
            self.driver.execute_script("arguments[0].click();", start_btn)
        except Exception as e:
            print(f"Error on Page 1 main block: {e}")
            # Fallback to finding by label or type
            inputs = self.driver.find_elements(By.CSS_SELECTOR, "input:not([type='hidden'])")
            if inputs:
                for inp in inputs:
                    try:
                        inp.clear()
                        inp.send_keys(asu_id)
                        break
                    except:
                        continue
                self.driver.execute_script("arguments[0].click();", self.driver.find_element(By.ID, "SurveySubmitButtonElement"))

        # Wait for Page 2
        wait.until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(), 'Interaction')]")))
        time.sleep(1) # Allow for JS transitions
        # Fill interactions
        for i, interaction in enumerate(interactions[:20]):
            try:
                # Based on recent inspection:
                # Interaction 1: ID = t_834450357, Summary = t_834450358
                # Each subsequent interaction increments by 2
                res_id_field_id = f"t_834450{357 + (i * 2)}"
                summary_field_id = f"t_834450{358 + (i * 2)}"
                
                res_input = self.driver.find_element(By.ID, res_id_field_id)
                summary_input = self.driver.find_element(By.ID, summary_field_id)
                
                res_input.clear()
                res_input.send_keys(interaction['asu_id'])
                
                summary_input.clear()
                summary_input.send_keys(interaction['summary'])
            except Exception as e:
                print(f"Error filling interaction {i}: {e}")
        
        # Click Next to go to Page 3
        # Need to handle the "Would you like to add more?" radio
        # Click Next to go to Page 3
        # Need to handle the "Would you like to add more?" radio
        try:
            # ID for 'No' is 834450404ID
            try:
                no_label = self.driver.find_element(By.XPATH, "//label[contains(@class, 'answerRow2ID')]")
                self.driver.execute_script("arguments[0].click();", no_label)
            except:
                no_radio = self.driver.find_element(By.ID, "834450404ID")
                self.driver.execute_script("arguments[0].click();", no_radio)
            
            # Button is SurveySubmitButtonElement
            next_btn = self.driver.find_element(By.ID, "SurveySubmitButtonElement")
            next_btn.click()
        except Exception as e:
            print(f"Error clicking Next on Page 2: {e}")

        # Handle potential "Continue Without Answering" modal if 17-20 were left blank
        try:
            time.sleep(2)
            continue_btn = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Continue Without Answering')]")
            continue_btn.click()
        except:
            pass

        # Page 3: Staff Concerns & Feedback
        # Fill with default or provided feedback
        feedback_fields = self.driver.find_elements(By.TAG_NAME, "textarea")
        defaults = [
            feedback.get("recognition", "no"),
            feedback.get("concerns", "no"),
            feedback.get("trends", "no"),
            feedback.get("assistance", "no")
        ]
        
        for k, text in enumerate(defaults):
            if k < len(feedback_fields):
                feedback_fields[k].send_keys(text)

        print("Stopping for manual submission as requested.")
        # Final button is usually "Done" or "Submit" or "Next" on last page
        
    def close(self):
        self.driver.quit()
