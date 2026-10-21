"""
Multi-lingual Treatment & Diagnostic Localization Engine.
Supports localized recommendations for:
- en: English
- hi: हिन्दी (Hindi)
- ta: தமிழ் (Tamil)
- te: తెలుగు (Telugu)
- es: Español (Spanish)
- bn: বাংলা (Bengali)
"""
from typing import Dict, Any

LOCALIZED_TREATMENTS: Dict[str, Dict[str, Dict[str, str]]] = {
    "PestInfestation": {
        "title": {
            "en": "Pest Infestation (Fall Armyworm / Aphids)",
            "hi": "कीट संक्रमण (फॉल आर्मीवॉर्म / माहू)",
            "ta": "பூச்சி தாக்குதல் (படைப்புழு / அசுவினி)",
            "te": "పురుగుల దాడి (ఫాల్ ఆర్మీవార్మ్ / పేనుబంక)",
            "es": "Infestación de plagas (Gusano cogollero / Pulgones)",
            "bn": "কীটপতঙ্গের আক্রমণ (ফল আর্মিওয়ার্ম / এফিড)"
        },
        "treatment": {
            "en": "Immediate Action: Spray 5% Neem Seed Kernel Extract (NSKE) or Bacillus thuringiensis (Bt) at dusk. Install pheromone traps (5 traps/acre). Quarantine infected crop section.",
            "hi": "त्वरित कार्रवाई: शाम के समय 5% नीम के बीज का अर्क (NSKE) या बैसिलस थुरिंजिएंसिस (Bt) का छिड़काव करें। फेरोमोन जाल (5 जाल/एकड़) लगाएं। प्रभावित हिस्से को अलग रखें।",
            "ta": "உடனடி நடவடிக்கை: மாலை வேளையில் 5% வேப்பங்கொட்டை கரைசல் அல்லது பேசிலஸ் துரிஞ்சியென்சிஸ் தெளிக்கவும். ஏக்கருக்கு 5 இனக்கவர்ச்சி பொறிகளை அமைக்கவும். பாதிக்கப்பட்ட பயிர்களை தனிமைப்படுத்தவும்.",
            "te": "తక్షణ చర్య: సాయంత్రం వేళల్లో 5% వేప గింజల కషాయం లేదా బాసిల్లస్ తురింజియెన్సిస్ స్ప్రే చేయండి. ఎకరాకు 5 లింగాకర్షక బుట్టలు ఏర్పాటు చేయండి.",
            "es": "Acción inmediata: Rocíe extracto de semilla de neem al 5% o Bacillus thuringiensis al atardecer. Instale trampas de feromonas (5 trampas/acre). Aísle el área afectada.",
            "bn": "অবিলম্বে ব্যবস্থা: সন্ধ্যায় ৫% নিম বীজের নির্যাস বা ব্যাসিলাস থুরিনজিয়েনসিস স্প্রে করুন। একরে ৫টি ফেরোমোন ফাঁদ লাগান। সংক্রামিত অংশ আলাদা করুন।"
        }
    },
    "BacterialBlight": {
        "title": {
            "en": "Bacterial Blight (Xanthomonas)",
            "hi": "जीवाणु झुलसा (बैक्टीरियल ब्लाइट)",
            "ta": "பாக்டீரியா இலைக்கருகல் நோய்",
            "te": "బాక్టీరియల్ బ్లైట్ తెగులు",
            "es": "Tizón bacteriano (Xanthomonas)",
            "bn": "ব্যাকটেরিয়াল ব্লাইট (জীবাণুঘটিত ধ্বসা)"
        },
        "treatment": {
            "en": "Immediate Action: Spray Copper Oxychloride (2.5g/L) mixed with Streptocycline (100mg/L). Drain standing water from the field. Avoid overhead irrigation and nitrogen overload.",
            "hi": "त्वरित कार्रवाई: कॉपर ऑक्सीक्लोराइड (2.5 ग्राम/लीटर) के साथ स्ट्रेप्टोसाइक्लिन (100 मिलीग्राम/लीटर) का छिड़काव करें। खेत से रुका हुआ पानी निकालें। अत्यधिक यूरिया से बचें।",
            "ta": "உடனடி நடவடிக்கை: காப்பர் ஆக்ஸிகுளோரைடு (2.5 கிராம்/லி) உடன் ஸ்ட்ரெப்டோமைசின் கலந்து தெளிக்கவும். வயலில் தேங்கிய தண்ணீரை வடிக்கவும். தழைச்சத்து உரங்களை குறைக்கவும்.",
            "te": "తక్షణ చర్య: కాపర్ ఆక్సిక్లోరైడ్ (2.5 గ్రా/లీ) మరియు స్ట్రెప్టోసైక్లిన్ కలిపి పిచికారీ చేయండి. పొలంలో నీటి నిల్వను తొలగించండి.",
            "es": "Acción inmediata: Aplique oxicloruro de cobre (2.5 g/L) con estreptociclina. Drene el agua estancada. Evite el exceso de fertilizantes nitrogenados.",
            "bn": "অবিলম্বে ব্যবস্থা: কপার অক্সিক্লোরাইড (২.৫ গ্রাম/লিটার) ও স্ট্রেপ্টোসাইক্লিন মিশিয়ে স্প্রে করুন। জমিতে জমা জল বের করে দিন। অতিরিক্ত ইউরিয়া প্রয়োগ এড়িয়ে চলুন।"
        }
    },
    "EarlyBlightFungus": {
        "title": {
            "en": "Early Blight (Alternaria solani)",
            "hi": "अगेती झुलसा (अल्टरनेरिया)",
            "ta": "ஆரம்ப இலைக்கருகல் பூஞ்சை நோய்",
            "te": "ముందస్తు తెగులు (శిలీంధ్రం)",
            "es": "Tizón temprano (Alternaria solani)",
            "bn": "আগাম ধ্বসা ছত্রাক রোগ"
        },
        "treatment": {
            "en": "Immediate Action: Apply Mancozeb 75% WP (2g/L) or Chlorothalonil. Remove lower diseased foliage. Maintain 40cm plant spacing for adequate air circulation.",
            "hi": "त्वरित कार्रवाई: मैंकोजेब 75% WP (2 ग्राम/लीटर) या क्लोरोथैलोनिल का छिड़काव करें। निचली रोगग्रस्त पत्तियों को काटकर नष्ट करें। पौधों के बीच हवा का प्रवाह बनाए रखें।",
            "ta": "உடனடி நடவடிக்கை: மேன்கோசெப் 75% WP (2 கிராம்/லி) தெளிக்கவும். பாதிக்கப்பட்ட கீழ் இலைகளை அகற்றி எரிக்கவும். காற்று சுழற்சியை உறுதி செய்யவும்.",
            "te": "తక్షణ చర్య: మాంకోజెబ్ 75% WP (2 గ్రా/లీ) పిచికారీ చేయండి. తెగులు సోకిన కింది ఆకులను తొలగించండి.",
            "es": "Acción inmediata: Aplique Mancozeb al 75% (2 g/L) o clorotalonil. Retire las hojas inferiores infectadas. Mejore la circulación de aire entre plantas.",
            "bn": "অবিলম্বে ব্যবস্থা: ম্যানকোজেব ৭৫% ডব্লিউপি (২ গ্রাম/লিটার) স্প্রে করুন। নিচের রোগাক্রান্ত পাতা কেটে ফেলুন।"
        }
    },
    "NutrientChlorosis": {
        "title": {
            "en": "Iron / Micronutrient Deficiency Chlorosis",
            "hi": "लौह एवं सूक्ष्म पोषक तत्वों की कमी (हरितहीनता)",
            "ta": "இரும்பு சத்து குறைபாடு (குளோரோசிஸ்)",
            "te": "ఇనుము / పోషకాల లోపం",
            "es": "Clorosis por deficiencia nutricional",
            "bn": "পুষ্টির ঘাটতিজনিত ক্লোরোসিস"
        },
        "treatment": {
            "en": "Immediate Action: Foliar spray of Ferrous Sulphate 0.5% + Citric Acid 0.1% dissolved in clean water. Check soil pH; adjust alkaline soil with gypsum or organic compost.",
            "hi": "त्वरित कार्रवाई: 0.5% फेरस सल्फेट + 0.1% साइट्रिक एसिड का पर्णीय छिड़काव करें। मिट्टी के pH की जांच करें और जैविक खाद का उपयोग करें।",
            "ta": "உடனடி நடவடிக்கை: 0.5% அன்னபேதி (பெர்ரஸ் சல்பேட்) + 0.1% எலுமிச்சை சாறு இலைவழி தெளிப்பு செய்யவும். அங்கக உரம் இடவும்.",
            "te": "తక్షణ చర్య: 0.5% ఫెర్రస్ సల్ఫేట్ ద్రావణాన్ని పిచికారీ చేయండి. సేంద్రీయ ఎరువులను వాడండి.",
            "es": "Acción inmediata: Aplicación foliar de sulfato ferroso al 0.5% con ácido cítrico al 0.1%. Verifique el pH del suelo y agregue compost orgánico.",
            "bn": "অবিলম্বে ব্যবস্থা: ০.৫% ফেরাস সালফেট এবং সাইট্রিক অ্যাসিড স্প্রে করুন। জমিতে জৈব সার প্রয়োগ করুন।"
        }
    },
    "HealthySample": {
        "title": {
            "en": "Healthy Crop / Normal Vegetation",
            "hi": "स्वस्थ फसल / सामान्य वनस्पति",
            "ta": "ஆரோக்கியமான பயிர் / இயல்பான நிலை",
            "te": "ఆరోగ్యకరమైన పంట",
            "es": "Cultivo saludable / Vegetación normal",
            "bn": "সুস্থ ফসল / স্বাভাবিক পাতা"
        },
        "treatment": {
            "en": "Maintenance Action: No pathogen detected. Maintain regular balanced N-P-K nutrient schedule and routine moisture monitoring.",
            "hi": "रखरखाव कार्रवाई: कोई रोग नहीं पाया गया। संतुलित खाद और सामान्य सिंचाई चक्र जारी रखें।",
            "ta": "பராமரிப்பு நடவடிக்கை: நோய் அறிகுறிகள் இல்லை. சீரான நீர்ப்பாசனம் மற்றும் வழக்கமான உரமிடுதலை தொடரவும்.",
            "te": "నిర్వహణ చర్య: ఎటువంటి తెగులు లేదు. సాధారణ నీటిపారుదల మరియు సమతుల్య ఎరువులు కొనసాగించండి.",
            "es": "Acción de mantenimiento: Sin patógenos detectados. Mantenga el régimen habitual de riego y fertilización equilibrada.",
            "bn": "রক্ষণাবেক্ষণ: কোনো রোগ সনাক্ত হয়নি। নিয়মিত জলসেচ এবং সুষম সার প্রয়োগ বজায় রাখুন।"
        }
    }
}

DEFAULT_LANG = "en"

def get_localized_treatment(condition: str, lang_code: str) -> Dict[str, str]:
    """
    Returns localized title and treatment plan for the condition.
    Falls back gracefully to English if requested language is unsupported.
    """
    target_data = LOCALIZED_TREATMENTS.get(condition, LOCALIZED_TREATMENTS["PestInfestation"])
    clean_lang = lang_code.lower() if lang_code else DEFAULT_LANG

    if clean_lang not in ["en", "hi", "ta", "te", "es", "bn"]:
        clean_lang = DEFAULT_LANG

    title = target_data["title"].get(clean_lang, target_data["title"][DEFAULT_LANG])
    treatment = target_data["treatment"].get(clean_lang, target_data["treatment"][DEFAULT_LANG])

    return {
        "title": title,
        "treatment_plan": treatment,
        "language_applied": clean_lang
    }
