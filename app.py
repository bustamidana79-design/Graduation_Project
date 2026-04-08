from flask import Flask, request, jsonify
import joblib

app = Flask(__name__)

# تحميل الموديل والنماذج
model = joblib.load('AI_Model/random_forest_model.pkl')
vectorizer = joblib.load('AI_Model/tfidf_vectorizer.pkl')

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    bio = data.get('bio', '')

    # تحويل النص الجديد
    text_vectorized = vectorizer.transform([bio]).toarray()

    # التنبؤ
    prediction = model.predict(text_vectorized)[0]

    return jsonify({'prediction': str(prediction)})

if __name__ == '__main__':
    app.run(debug=True)