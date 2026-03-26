import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_MODEL = "qwen2.5:14b"

class OllamaClient:
    def __init__(self, model=DEFAULT_MODEL):
        self.model = model
        self.base_url = "http://localhost:11434/api"

    def check_ollama(self):
        """Checks if the Ollama service is running locally."""
        try:
            response = requests.get("http://localhost:11434/")
            return response.status_code == 200
        except requests.exceptions.ConnectionError:
            return False
            
    def get_installed_models(self):
        """Returns a list of installed models."""
        try:
            response = requests.get(f"{self.base_url}/tags")
            response.raise_for_status()
            models = response.json().get('models', [])
            return [m['name'] for m in models]
        except Exception:
            return []
            
    def pull_model(self, model_name, stream=False):
        """Triggers a download for a specific model."""
        try:
            # We use stream=True so we can stream progress back to the UI
            response = requests.post(
                f"{self.base_url}/pull", 
                json={"name": model_name, "stream": stream},
                stream=stream
            )
            response.raise_for_status()
            if stream:
                return response
            return True
        except Exception as e:
            print(f"Error pulling model {model_name}: {e}")
            return False

    def delete_model(self, model_name):
        """Deletes a specific model from Ollama."""
        try:
            response = requests.delete(
                f"{self.base_url}/delete", 
                json={"name": model_name}
            )
            response.raise_for_status()
            return True
        except Exception as e:
            print(f"Error deleting model {model_name}: {e}")
            return False

    def generate_interaction(self, resident_name, past_interactions, topic=""):
        context = "\n".join([f"- {i}" for i in past_interactions])
        
        topic_instruction = f"Specifically mention or focus the conversation around: {topic}" if topic else "Mention a common student topic: classes, floor meetings, social activities, stress about finals/essays, or running into them in the hallway/lounge."
        
        prompt = f"""
You are an experienced Residential Assistant (RA) at Arizona State University. 
Your goal is to write a brief, natural-sounding summary of a recent interaction with a resident named {resident_name}.

Past interactions with this resident:
{context}

Guidelines:
1. The interaction should be casual and brief (2-4 sentences).
2. It should sound like it was written by a college student RA (professional but relatable).
3. {topic_instruction}
4. Do not exceed 100 words.
5. Provide ONLY the text of the interaction.

Interaction:
"""
        
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False
        }
        
        try:
            response = requests.post(f"{self.base_url}/generate", json=payload)
            response.raise_for_status()
            return response.json().get("response", "").strip().strip('"')
        except Exception as e:
            return f"Error generating interaction: {str(e)}"

if __name__ == "__main__":
    # Test generation
    client = OllamaClient()
    test_interaction = client.generate_interaction("Kathy", ["Talked about switching math classes.", "Asked about CA applications."])
    print(f"Test Output:\n{test_interaction}")
