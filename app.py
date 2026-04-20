@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    bio = data.get('bio', '')
    
    # --- الإضافة الجديدة لاستقبال البيانات الـ 6 ---
    # ملاحظة: حتى لو ما غيرتي الكود في Next.js لسه، لازم تحطي قيم افتراضية هون
    behavioral = [
        data.get('link_reachable', 0),
        data.get('platform_score', 0.5),
        data.get('has_files', 0),
        data.get('fields_complete', 0),
        data.get('has_second_link', 0),
        data.get('bio_word_count', len(bio.split()))
    ]
    
    # تحويل النص (الـ 500 كلمة)
    text_vectorized = vectorizer.transform([bio]).toarray()
    
    # --- دمج النص مع السلوك (للوصول لرقم 506) ---
    final_features = np.hstack([text_vectorized, [behavioral]])
    
    # طلب التوقع باستخدام المصفوفة الجديدة
    prediction = model.predict(final_features)
    probability = model.predict_proba(final_features)
    
    return jsonify({
        'status': int(prediction[0]),
        'confidence': float(max(probability[0]))
    })