from flask import Flask, request, jsonify
import joblib
import os

app = Flask(_name_)

# تحميل الموديل والمترجم (العقل والنظارة)
model = joblib.load('AI_Model/random_forest_model.pkl')
vectorizer = joblib.load('AI_Model/tfidf_vectorizer.pkl')

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    bio = data.get('bio', '')
    
    # تحويل النص الجديد ليفهمه الموديل
    text_vectorized = vectorizer.transform([bio]).toarray()
    
    # طلب التوقع من الـ AI
    prediction = model.predict(text_vectorized)
    probability = model.predict_proba(text_vectorized)
    
    # إرجاع النتيجة للموقع
    return jsonify({
        'status': int(prediction[0]), # 1 مقبول، 0 مرفوض
        'confidence': float(max(probability[0])) # نسبة التأكد
    })

if _name_ == '_main_':
    app.run(port=5000)