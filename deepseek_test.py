import os
from openai import OpenAI

# 1. Set your DeepSeek API Key here
# Paste your actual key inside the quotes below
os.environ["DEEPSEEK_API_KEY"] = "sk-5e0fb50f002b4e7096c4fbf2f6ce1a2a"

# Initialize the client pointing to DeepSeek's endpoint
client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"), # Reads the key we just set
    base_url="https://api.deepseek.com"
)

# 2. Ask a question
response = client.chat.completions.create(
  model="deepseek-chat",
  messages=[
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello! Please tell me a short joke about web design."}
  ]
)

# 3. Print the result
print(response.choices[0].message.content)