"""Run from repo root: python3 scripts/check_dew_language.py."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from app.services.dewchat import detect_lang

for text, want in [
    ('क्या धूप Bt को नुकसान पहुँचाती है?', 'hi'),
    ('मेरे पौधे को नुकसान हुआ है', 'hi'),
    ('कैटरपिलर से पौधों को बचाने के लिए मुझे क्या करना चाहिए', 'hi'),
    ('माझ्या झाडाला पाणी किती द्यायचे?', 'mr'),
    ('मला मदत पाहिजे', 'mr'),
    ('How can you help me protect plants from caterpillars?', 'en'),
]:
    assert detect_lang(text) == want, (text, detect_lang(text))
print('PASS: backend language routing (6 cases)')
