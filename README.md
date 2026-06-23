# CoreX Graduation Project

CoreX is a B2B web platform built with Next.js. The system supports multiple user roles, including small businesses, suppliers, shipping companies, supporters, and administrators.

The project includes dashboards, product management, orders, shipping, chat/support features, payment flow, and an AI-based application evaluation service.

## Technologies Used

- Next.js
- React
- TypeScript
- Supabase
- Python
- FastAPI
- Scikit-learn
- Azure deployment

## Getting Started

Install the project dependencies:


npm install

Run the development server:
npm run dev

Open:
http://localhost:3000

AI Service
The AI model files and training data are located in:
AI_Model/
Training dataset:
AI_Model/seed_training_data.json

The testing dataset is generated inside the training script using train_test_split with a test size of 25%.

Training and testing metrics are available in:
AI_Model/training_metrics.json
To run the AI service locally, install the Python requirements:
pip install -r requirements-ai.txt
Then run:
python -m uvicorn app:app --host 127.0.0.1 --port 8000


Deployment
The final application was deployed on Microsoft Azure.
Live website:
https://grad-b2b-project-hmfebpecbnfsfcd2.polandcentral-01.azurewebsites.net/

Source Code
GitHub repository:
https://github.com/bustamidana79-design/Graduation_Project
