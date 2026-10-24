// Dew chat: a guided assistant built on the app's own evidence and checks.
// It answers from the same cited data the result page uses, remembers what you
// scanned this session, and says when it does not know. It is not a general
// AI and never invents spray advice.
//
// The whole conversation is kept as data (`history`). Switching language
// re-renders every message in the new language and never clears the chat or
// the session context (scanned product, corrections, mix results).
import { spokenText, speechParts, speechMood, chooseVoice } from "./dewspeech.js";
import { mascot } from "./mascot.js";
import { ICON } from "./icons.js";
import * as api from "./api.js";
import * as snd from "./sounds.js";
import { parseWire, classify } from "./speechwire.js";
import { readLabel } from "./ocr.js";
import { guideIntent, pestIntent, btIntent, sprayHowIntent, nonBtProductIntent } from "./dewroute.js";

let ctx = { getContext: () => ({}), openScan: () => {}, openMix: () => {}, openResult: () => {}, showDew: () => {}, exitDew: () => {}, onCorrection: () => {} };
let lang = (window.bioI18n && window.bioI18n.lang) || localStorage.getItem("biooasis-dew-lang") || "en";
if (window.bioI18n) window.bioI18n.onChange(l => setLang(l));
let busy = false;
let lastQuestion = null; // last open question sent to Dew AI, for the Retry chip
let lastTopic = null; // grounded topic of the conversation (e.g. "bt") for follow-ups
let voiceTurn = false; // voice in -> voice out, even if sound effects are off
const history = []; // { who: "dew"|"user"|"note", msg, chips, img }
// Blob URLs of photos the user added to this chat. They never leave the
// device (OCR runs locally) and are revoked when the page goes away.
const chatPhotoUrls = new Set();
globalThis.addEventListener?.("pagehide", () => { chatPhotoUrls.forEach(u => URL.revokeObjectURL(u)); chatPhotoUrls.clear(); });

const L = {
  en: {
    aiNotice: "Quick note: open questions are answered by Gemini. Only your questions, recent chat, and scanned label text are shared - never photos.",
    greet: "Namaste! I'm Dew. Ask me about your spray, sunlight, water, or mixing two products.",
    chips: ["What can you do?", "Does sunlight hurt Bt?", "Check a label", "Mix two products"],
    fallback: "I don't have evidence for that. For spray decisions, please ask an agronomist. Try asking me about sunlight, water, or mixing products.",
    what: "I can read a label photo, guess the kind of living spray, show what research says about keeping it alive, and check two products together. Every fact has a source. If I don't know, I say so.",
    scanning: "Reading your label photo...",
    heard: "I heard:",
    noMic: "This browser can't hear you. Typing works everywhere.",
    noNet: "Voice typing needs an internet connection and a browser that supports it, like Chrome. You can type to me instead.",
    listening: "Listening...",
    vThink: "Dew is thinking...",
    vSpeak: "Dew is speaking - tap the mic to jump in.",
    vIdle: "Tap the mic to talk.",
    voiceUnavailable: "Voice unavailable for this language. Your reply is in the chat. Check your phone text-to-speech language settings, then tap the mic to continue.",
    labelBtn: "Add a label",
    photoSent: "Label photo",
    needScan: "Scan a label first, then I can tell you more about it.",
    mixLead: "Let's check both labels together.",
    afterResult: n => `That looks like ${n}. Want the details, or check it with another product?`,
    seeResult: "See full result",
    unknown: "I couldn't place that label. Try a clearer photo, or type the words on the label.",
    expiryOn: d => `One label shows a date that has passed (${d}). That alone doesn't prove a product is fake or dead.`,
    thanks: "Anytime. Dew stays in your pocket.",
    corrected: n => `Got it - I'll remember it as ${n} for this session.`,
    noMatch: "I didn't catch that - try again, or type it.",
    noMatchAgain: "Still nothing - typing may work better here.",
    langNote: "Language changed - our chat and everything you showed me carries on.",
    autoNote: "That sounded like English - I'll answer in English.",
    placeholder: "Type to Dew...",
    tagAi: "Dew AI",
    tagLocal: "built-in guide",
    aiOff: "Dew AI is not connected yet, so open questions are answered from my built-in guide for now.",
    aiDownMsg: "Dew AI couldn't answer right now. Please try again in a little while.",
    whichProduct: "Which product are you asking about? Tell me the name on its label, and I will check what the label and research say - I will not guess a procedure for the wrong product.",
    quotaMsg: "Dew AI's free quota is used up for now. Please try again later.",
    retry: "Retry",
  },
  hi: {
    aiNotice: "एक छोटी सूचना: खुले सवालों के जवाब Gemini देता है। सिर्फ आपके सवाल, हाल की चैट और स्कैन किए गए लेबल का टेक्स्ट ही भेजा जाता है - फोटो कभी नहीं।",
    greet: "नमस्ते! मैं ड्यू हूँ। अपने स्प्रे, धूप, पानी या दो प्रोडक्ट मिलाने के बारे में पूछें।",
    chips: ["आप क्या कर सकते हो?", "क्या धूप Bt को नुकसान पहुँचाती है?", "लेबल जाँचें", "दो प्रोडक्ट मिलाएँ"],
    fallback: "मेरे पास इसका सबूत नहीं है। स्प्रे के फ़ैसले के लिए कृषि विशेषज्ञ से पूछें। आप मुझसे धूप, पानी या प्रोडक्ट मिलाने के बारे में पूछ सकते हैं।",
    what: "मैं लेबल की फोटो पढ़ सकता हूँ, जीवित स्प्रे की तरह बता सकता हूँ, उसे ज़िंदा रखने की रिसर्च दिखा सकता हूँ, और दो प्रोडक्ट साथ में जाँच सकता हूँ। हर बात के साथ स्रोत होता है। अगर मुझे नहीं पता, तो मैं कह देता हूँ।",
    scanning: "आपकी लेबल फोटो पढ़ रहा हूँ...",
    heard: "मैंने सुना:",
    noMic: "यह ब्राउज़र आपकी आवाज़ नहीं सुन सकता। टाइप करना हर जगह चलता है।",
    noNet: "आवाज़ पहचानने के लिए इंटरनेट और Chrome जैसा ब्राउज़र चाहिए। आप टाइप कर सकते हैं।",
    listening: "सुन रहा हूँ...",
    vThink: "ड्यू सोच रहा है...",
    vSpeak: "ड्यू बोल रहा है - बीच में बोलने के लिए माइक दबाएं।",
    vIdle: "बोलने के लिए माइक दबाएं।",
    voiceUnavailable: "इस भाषा की आवाज़ उपलब्ध नहीं है। जवाब चैट में है। फोन की टेक्स्ट-टू-स्पीच भाषा सेटिंग जाँचें, फिर माइक दबाएं।",
    labelBtn: "लेबल जोड़ें",
    photoSent: "लेबल फोटो",
    needScan: "पहले एक लेबल स्कैन करें, फिर मैं उसके बारे में बता सकता हूँ।",
    mixLead: "चलिए दोनों लेबल साथ में जाँचते हैं।",
    afterResult: n => `यह ${n} जैसा लगता है। पूरी जानकारी चाहिए, या दूसरे प्रोडक्ट के साथ जाँचें?`,
    seeResult: "पूरा नतीजा देखें",
    unknown: "मैं वह लेबल पहचान नहीं पाया। साफ़ फोटो लें या लेबल के शब्द टाइप करें।",
    expiryOn: d => `एक लेबल पर बीती हुई तारीख (${d}) दिखी। सिर्फ़ इससे प्रोडक्ट नकली या ख़राब साबित नहीं होता।`,
    thanks: "कोई बात नहीं। ड्यू आपकी जेब में रहता है।",
    corrected: n => `ठीक है - इस सत्र के लिए मैं इसे ${n} के रूप में याद रखूँगा।`,
    noMatch: "मुझे वह सुनाई नहीं दिया - फिर कहें या लिखें।",
    noMatchAgain: "अभी भी सुनाई नहीं दिया - यहाँ लिखना आसान रहेगा।",
    langNote: "भाषा बदल गई - हमारी बातचीत और आपने जो दिखाया, सब जारी रहता है।",
    autoNote: "आपकी बात हिंदी लगी - मैं हिंदी में जवाब दूँगा।",
    placeholder: "ड्यू को लिखें...",
    tagAi: "ड्यू AI",
    tagLocal: "बिल्ट-इन गाइड",
    aiOff: "ड्यू AI अभी जुड़ा नहीं है, इसलिए खुले सवालों के जवाब अभी मेरी बिल्ट-इन गाइड से दिए जाते हैं।",
    aiDownMsg: "ड्यू AI अभी जवाब नहीं दे पाया। कृपया थोड़ी देर बाद फिर कोशिश करें।",
    whichProduct: "आप किस प्रोडक्ट के बारे में पूछ रहे हैं? लेबल पर लिखा नाम बताइए, मैं उसका लेबल और रिसर्च जाँच कर बताऊँगा - गलत प्रोडक्ट की विधि अंदाज़े से नहीं बताऊँगा।",
    quotaMsg: "ड्यू AI का फ्री कोटा अभी खत्म हो गया है। कृपया बाद में कोशिश करें।",
    retry: "फिर से कोशिश करें",
  },
  mr: {
    aiNotice: "एक छोटीशी सूचना: खुल्या प्रश्नांची उत्तरे Gemini देते. फक्त तुमचे प्रश्न, अलीकडची चॅट आणि स्कॅन केलेल्या लेबलचा मजकूरच पाठवला जातो - फोटो कधीही नाही.",
    greet: "नमस्कार! मी ड्यू. तुमच्या स्प्रे, सूर्यप्रकाश, पाणी किंवा दोन प्रोडक्ट मिसळण्याबद्दल विचारा.",
    chips: ["तू काय करू शकतोस?", "सूर्यप्रकाश Bt ला इजा करतो का?", "लेबल तपासा", "दोन प्रोडक्ट मिसळा"],
    fallback: "माझ्याकडे याचा पुरावा नाही. स्प्रेच्या निर्णयासाठी कृषी तज्ज्ञांना विचारा. तुम्ही मला सूर्यप्रकाश, पाणी किंवा प्रोडक्ट मिसळण्याबद्दल विचारू शकता.",
    what: "मी लेबलचा फोटो वाचू शकतो, जिवंत स्प्रेचा प्रकार सांगू शकतो, तो जिवंत ठेवण्याचा संशोधन दाखवू शकतो आणि दोन प्रोडक्ट एकत्र तपासू शकतो. प्रत्येक गोष्टीसोबत स्रोत असतो. मला माहित नसेल तर मी सांगतो.",
    scanning: "तुमचा लेबल फोटो वाचतोय...",
    heard: "मी ऐकलं:",
    noMic: "हा ब्राउझर तुमचा आवाज ऐकू शकत नाही. टाइप करणे सर्वत्र चालते.",
    noNet: "आवाज ओळखण्यासाठी इंटरनेट आणि Chrome सारखा ब्राउझर लागतो. तुम्ही टाइप करू शकता.",
    listening: "ऐकतोय...",
    vThink: "ड्यू विचार करतोय...",
    vSpeak: "ड्यू बोलतोय - मध्ये बोलण्यासाठी माइक दाबा.",
    vIdle: "बोलण्यासाठी माइक दाबा.",
    voiceUnavailable: "या भाषेचा आवाज उपलब्ध नाही. उत्तर चॅटमध्ये आहे. फोनची टेक्स्ट-टू-स्पीच भाषा सेटिंग तपासा, मग माइक दाबा.",
    labelBtn: "लेबल जोडा",
    photoSent: "लेबल फोटो",
    needScan: "आधी एक लेबल स्कॅन करा, मग मी त्याबद्दल सांगू शकतो.",
    mixLead: "चला दोन्ही लेबल एकत्र तपासूया.",
    afterResult: n => `हे ${n} सारखे दिसते. सविस्तर माहिती हवी, की दुसऱ्या प्रोडक्टसोबत तपासायचे?`,
    seeResult: "पूर्ण निकाल पाहा",
    unknown: "मी ते लेबल ओळखू शकलो नाही. स्पष्ट फोटो घ्या किंवा लेबलवरील शब्द टाइप करा.",
    expiryOn: d => `एका लेबलवर उलटलेली तारीख (${d}) दिसली. केवळ यामुळे प्रोडक्ट खोटे किंवा निकामी ठरत नाही.`,
    thanks: "काही हरकत नाही. ड्यू तुमच्या खिशात राहतो.",
    corrected: n => `ठीक आहे - या सत्रासाठी मी ते ${n} म्हणून लक्षात ठेवतो.`,
    noMatch: "मला ते ऐकू आले नाही - पुन्हा सांगा किंवा लिहा.",
    noMatchAgain: "अजूनही ऐकू आले नाही - इथे लिहिणे सोपे जाईल.",
    langNote: "भाषा बदलली - आपली गप्पा आणि तुम्ही दाखवलेले सर्व काही चालू राहते.",
    autoNote: "तुमची बोली मराठी वाटली - मी मराठीत उत्तर देतो.",
    placeholder: "ड्यूला लिहा...",
    tagAi: "ड्यू AI",
    tagLocal: "अंगभूत मार्गदर्शक",
    aiOff: "ड्यू AI अजून जोडलेले नाही, त्यामुळे खुल्या प्रश्नांची उत्तरे सध्या माझ्या अंगभूत मार्गदर्शकातून दिली जातात.",
    aiDownMsg: "ड्यू AI आत्ता उत्तर देऊ शकले नाही. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.",
    whichProduct: "तुम्ही कोणत्या प्रोडक्टबद्दल विचारत आहात? लेबलवरील नाव सांगा, मी त्याचे लेबल आणि संशोधन तपासून सांगतो - चुकीच्या प्रोडक्टची पद्धत अंदाजे सांगणार नाही.",
    quotaMsg: "ड्यू AI चे मोफत कोटा आत्ता संपले आहे. कृपया नंतर प्रयत्न करा.",
    retry: "पुन्हा प्रयत्न करा",
  },
};

const SUN_FACT = {
  bt: { en: "Yes - sunlight kills Bt spores. In one study cited by the US NPIC, less than 9% of Bt spores could still grow after 24 hours on a leaf. Spraying late in the day is kinder to Bt.", hi: "हाँ - धूप Bt स्पोर्स को मार देती है। अमेरिकी NPIC के हवाले से एक अध्ययन में, पत्ती पर 24 घंटे बाद 9% से भी कम Bt स्पोर्स ज़िंदा बचे। शाम को छिड़काव Bt के लिए बेहतर है।", mr: "होय - सूर्यप्रकाश Bt स्पोअर्स निकामी करतो. अमेरिकेच्या NPIC ने उद्धृत केलेल्या एका अभ्यासात, पानावर 24 तासांनी 9% पेक्षा कमी Bt स्पोअर्स जिवंत राहिले. संध्याकाळी फवारणी Bt साठी चांगली." },
  beauveria: { en: "Beauveria spores are fragile in sun and heat - that is why its labels warn about storage in high temperatures.", hi: "बोवेरिया स्पोर्स धूप और गर्मी में नाज़ुक होते हैं - इसीलिए इसके लेबल गर्मी में स्टोरेज की चेतावनी देते हैं।", mr: "बोव्हेरिया स्पोअर्स ऊन आणि उष्णतेत नाजूक असतात - म्हणूनच त्याच्या लेबलवर उष्णतेत साठवणूकीबद्दल इशारा असतो." },
  other: { en: "Sun and UV are hard on most living sprays. Check the research tab on your product's result page for its exact sources.", hi: "धूप और UV ज़्यादातर जीवित स्प्रे के लिए कठिन हैं। अपने प्रोडक्ट के नतीजे वाले पेज पर रिसर्च टैब देखें।", mr: "ऊन आणि UV बहुतेक जिवंत स्प्रेसाठी कठीण असतात. तुमच्या प्रोडक्टच्या निकाल पानावर संशोधन टॅब पाहा." },
};

// Grounded caterpillar/Bt conversation, every line sourced from the app's own
// evidence cards: DiPel DF label (spores + protein toxins, caterpillar must eat
// treated leaves), Javelin WG label (treat small/newly hatched larvae, good
// coverage), XenTari label (strain differences), NPIC-cited study (<9% spores
// survive 24h on a leaf), UF/IFAS water pH guidance. Dew never invents a dose.
const PEST_FACT = {
  en: "A suitable Bt spray may help with these caterpillars. Bt (Bacillus thuringiensis) products are living sprays, and different Bt strains target different insect groups - per the US NPIC fact sheet, caterpillar products are the ones meant for this pest. The DiPel DF label says the caterpillar must eat treated leaves for it to work. Which crop and which product do you have? Tell me, and I will check what its label and the research say for your case.",
  hi: "इन कैटरपिलर के लिए उपयुक्त Bt स्प्रे मदद कर सकता है। Bt (Bacillus thuringiensis) प्रोडक्ट जीवित स्प्रे होते हैं, और अलग-अलग Bt स्ट्रेन अलग-अलग कीट समूहों पर काम करते हैं - अमेरिकी NPIC फैक्ट शीट के मुताबिक इस कीट के लिए कैटरपिलर वाले प्रोडक्ट होते हैं। DiPel DF लेबल कहता है कि असर तभी होता है जब कैटरपिलर छिड़काव वाली पत्ती खाए। आपके पास कौन सी फसल और कौन सा प्रोडक्ट है? बताइए, मैं आपके मामले के लिए उसका लेबल और रिसर्च जाँच कर बताता हूँ।",
  mr: "या अळ्यांसाठी योग्य Bt स्प्रे मदत करू शकतो. Bt (Bacillus thuringiensis) प्रोडक्ट हे जिवंत स्प्रे असतात आणि वेगवेगळे Bt स्ट्रेन वेगवेगळ्या किटक समूहांवर काम करतात - अमेरिकन NPIC फॅक्ट शीटनुसार या किडीसाठी अळ्यांवरील प्रोडक्ट असतात. DiPel DF लेबल सांगते की अळीने फवारलेली पाने खाल्लीच तर परिणाम होतो. तुमच्याकडे कोणते पीक आणि कोणता प्रोडक्ट आहे? सांगा, मी तुमच्या बाबतीसाठी त्याचे लेबल आणि संशोधन तपासून सांगतो.",
};
const SPRAY_GUIDE = {
  en: "These are general points from Bt labels and cited research, not directions for your farm yet: 1) Labels (DiPel DF, Javelin WG): spray while the caterpillars are small and newly hatched, and cover the leaves well - the caterpillar must eat treated leaves. 2) Research cited by the US NPIC found sunlight quickly weakens Bt on leaves, so the right spray time is what your product's label says for your crop and weather - there is no single perfect time. 3) A Journal of Economic Entomology study found water pH changes how well Bt works, so follow your label's water directions. The exact dose is on your product's label; I will not invent one. Tell me your crop and product, and I will check what applies to your case.",
  hi: "Bt लेबल और उद्धृत रिसर्च के ये सामान्य बिंदु हैं, अभी आपके खेत के निर्देश नहीं: 1) लेबल (DiPel DF, Javelin WG): जब कैटरपिलर छोटे और नए निकले हों तब छिड़कें, और पत्तियों को अच्छी तरह ढकें - कैटरपिलर को छिड़काव वाली पत्ती खानी ही पड़ती है। 2) अमेरिकी NPIC के हवाले वाली रिसर्च में पाया गया कि धूप पत्तियों पर Bt को जल्दी कमज़ोर कर देती है, इसलिए सही छिड़काव समय वही है जो आपके प्रोडक्ट का लेबल आपकी फसल और मौसम के लिए कहे - कोई एक परफेक्ट समय नहीं है। 3) Journal of Economic Entomology के अध्ययन में पाया गया कि पानी का pH, Bt की असरदारता बदल देता है, इसलिए पानी के लिए अपने लेबल के निर्देश मानें। सही मात्रा आपके प्रोडक्ट के लेबल पर है; मैं अपने से नहीं बनाऊँगा। अपनी फसल और प्रोडक्ट बताइए, मैं जाँच कर बताऊँगा कि आपके मामले में क्या लागू होता है।",
  mr: "Bt लेबल आणि उद्धृत संशोधनातील हे सामान्य मुद्दे आहेत, अजून तुमच्या शेतासाठी सूचना नाहीत: 1) लेबले (DiPel DF, Javelin WG): अळ्या छोट्या आणि नुकत्याच निघालेल्या असताना फवारा आणि पाने व्यवस्थित झाका - अळीने फवारलेली पाने खाणेच गरजेचे. 2) अमेरिकन NPIC ने उद्धृत केलेल्या संशोधनात आढळले की सूर्यप्रकाश पानांवरील Bt लवकर कमकुवत करतो, म्हणून योग्य फवारणी वेळ म्हणजे तुमच्या प्रोडक्टचे लेबल तुमच्या पिकासाठी आणि हवामानासाठी सांगते ती - एकच परफेक्ट वेळ नसते. 3) Journal of Economic Entomology मधील अभ्यासात आढळले की पाण्याचा pH, Bt ची कार्यक्षमता बदलतो, म्हणून पाण्याबाबत तुमच्या लेबलवरील सूचना पाळा. योग्य मात्रा तुमच्या प्रोडक्टच्या लेबलवर आहे; मी स्वतःहून बनवणार नाही. तुमचे पीक आणि प्रोडक्ट सांगा, मी तुमच्या बाबतीत काय लागू होते ते तपासून सांगतो.",
};
const BT_FACT = {
  en: "Bt is Bacillus thuringiensis, a living bacterium. Its products carry spores and insecticidal proteins; when a susceptible caterpillar eats them, the proteins act in its gut, it stops feeding and dies within a few days - per the US NPIC fact sheet. Strains differ by target insect group - kurstaki products such as DiPel target caterpillars, per the DiPel DF label. Sunlight quickly weakens Bt on leaves, which is why spray timing matters.",
  hi: "Bt यानी Bacillus thuringiensis, एक जीवित बैक्टीरिया। इसके प्रोडक्ट में स्पोर्स और कीटनाशी प्रोटीन होते हैं; जब संवेदनशील कैटरपिलर इन्हें खाता है तो प्रोटीन उसकी आंत में काम करते हैं, वह खाना बंद कर देता है और कुछ दिनों में मर जाता है - अमेरिकी NPIC फैक्ट शीट के मुताबिक। स्ट्रेन के हिसाब से लक्ष्य कीट समूह अलग होता है - DiPel जैसे kurstaki प्रोडक्ट कैटरपिलर पर काम करते हैं, DiPel DF लेबल के मुताबिक। धूप पत्तियों पर Bt को जल्दी कमज़ोर कर देती है, इसीलिए छिड़काव का समय ज़रूरी है।",
  mr: "Bt म्हणजे Bacillus thuringiensis, एक जिवंत जीवाणू. त्याच्या प्रोडक्टमध्ये स्पोअर्स आणि किटकनाशी प्रोटीन असतात; संवेदनशील अळी ते खाल्ली की प्रोटीन तिच्या पोटात काम करतात, ती खाणे थांबवते आणि काही दिवसांत मरते - अमेरिकन NPIC फॅक्ट शीटनुसार. स्ट्रेननुसार लक्ष्य किटक समूह वेगळा असतो - DiPel सारखे kurstaki प्रोडक्ट अळ्यांवर काम करतात, DiPel DF लेबलनुसार. सूर्यप्रकाश पानांवरील Bt लवकर कमकुवत करतो, म्हणूनच फवारणीची वेळ महत्त्वाची असते.",
};
// Voice turns use a short grounded answer. The full sourced explanation stays
// in the chat, not a citation readout. These are deliberately authored, not
// generic truncations: the product/crop check and dose limits remain audible.
const VOICE_PEST = {
  en: "That sounds worrying. A suitable bee tee product may help with caterpillars, but it depends on the crop and the product label. Which crop is affected, and which product do you have?",
  hi: "समझ रहा हूँ, फसल की चिंता हो रही होगी। कैटरपिलर के लिए सही बी टी प्रोडक्ट मदद कर सकता है, लेकिन फसल और प्रोडक्ट का लेबल जाँचना ज़रूरी है। आपकी फसल कौन सी है, और कौन सा प्रोडक्ट है?",
  mr: "समजलं, पिकाची काळजी वाटत असेल. अळ्यांसाठी योग्य बी टी प्रोडक्ट मदत करू शकतो, पण पीक आणि प्रोडक्टचे लेबल तपासावे लागेल. तुमचे पीक कोणते, आणि कोणते प्रोडक्ट आहे?",
};
const VOICE_BT = {
  en: "Bee tee is a living bacterium used in some crop treatments. The caterpillar has to eat treated leaves for a suitable caterpillar product to work. Different strains target different insects, so we still need to check your product label.",
  hi: "बी टी एक जीवित बैक्टीरिया है, जो कुछ फसल उपचारों में होता है। कैटरपिलर वाले सही प्रोडक्ट के असर के लिए कैटरपिलर को छिड़काव वाली पत्ती खानी पड़ती है। अलग स्ट्रेन अलग कीटों पर काम करते हैं, इसलिए आपके प्रोडक्ट का लेबल जाँचना ज़रूरी है।",
  mr: "बी टी हा एक जिवंत जीवाणू आहे, जो काही पीक उपचारांमध्ये असतो. अळ्यांसाठीच्या योग्य प्रोडक्टचा परिणाम होण्यासाठी अळीने फवारलेली पाने खाणे गरजेचे आहे. वेगवेगळे स्ट्रेन वेगवेगळ्या किडींवर काम करतात, म्हणून तुमच्या प्रोडक्टचे लेबल तपासावे लागेल.",
};
const VOICE_GUIDE = {
  en: "Let's check the label before choosing a dose or time. In general, bee tee caterpillar labels call for treating small larvae and covering the leaves well. Sunlight can weaken it, but the right time and water directions depend on your product, crop and weather. Which crop and product are you using? I won't guess a dose.",
  hi: "पहले लेबल जाँचते हैं, फिर मात्रा या समय तय करेंगे। आम तौर पर कैटरपिलर वाले बी टी लेबल छोटी इल्लियों पर छिड़काव और पत्तियाँ अच्छी तरह ढकने को कहते हैं। धूप इसे कमज़ोर कर सकती है, लेकिन सही समय और पानी के निर्देश आपके प्रोडक्ट, फसल और मौसम पर निर्भर हैं। आपकी फसल और प्रोडक्ट कौन से हैं? मात्रा का अंदाज़ा नहीं लगाऊँगा।",
  mr: "आधी लेबल तपासू, मग मात्रा किंवा वेळ ठरवू. साधारणपणे अळ्यांसाठीच्या बी टी लेबलवर छोट्या अळ्यांवर फवारणी आणि पाने व्यवस्थित भिजवणे सांगितलेले असते. सूर्यप्रकाशामुळे परिणाम कमी होऊ शकतो, पण योग्य वेळ आणि पाण्याच्या सूचना प्रोडक्ट, पीक आणि हवामानावर अवलंबून आहेत. तुमचे पीक आणि प्रोडक्ट कोणते? मात्रेचा अंदाज लावणार नाही.",
};
const PEST_CHIP = { en: "How and when to spray", hi: "कैसे और कब छिड़कें", mr: "कसे आणि केव्हा फवारायचे" };

const WATER_FACT = {
  en: "Water between pH 6 and 7 is kindest to most living sprays. Very alkaline water (above 8) is a known problem. A cheap pH strip tells you in a minute.",
  hi: "pH 6 से 7 का पानी ज़्यादातर जीवित स्प्रे के लिए सबसे अच्छा है। बहुत क्षारीय पानी (8 से ऊपर) एक जानी-मानी समस्या है। सस्ती pH स्ट्रिप एक मिनट में बता देती है।",
  mr: "pH 6 ते 7 चे पाणी बहुतेक जिवंत स्प्रेसाठी सर्वांत चांगले. खूप अल्कली पाणी (8 च्या वर) ही ओळखीची अडचण आहे. स्वस्त pH स्ट्रिप एका मिनिटात सांगते.",
};

const $ = id => document.getElementById(id);
const txt = (m, l = lang) => typeof m === "function" ? m(l) : (m && typeof m === "object" ? m[l] : m);
const chipList = (c, l = lang) => typeof c === "function" ? c(l) : c;

export function init(hooks) {
  ctx = { ...ctx, ...hooks };
  $("open-dew").onclick = open;
  $("dew-close").onclick = () => { exitVoice(); ctx.exitDew(); };
  $("dew-send").onclick = sendText;
  $("dew-input").addEventListener("keydown", e => { if (e.key === "Enter") sendText(); });
  $("dew-mic").onclick = mic;
  $("dv-mic").onclick = dvMic;
  $("dv-exit").onclick = exitVoice;
  $("dv-mic").innerHTML = ICON.mic;
  $("dv-exit").innerHTML = ICON.back;
  $("dew-attach").onclick = () => ctx.pickLabel();
  $("dew-log").addEventListener("click", e => {
    const b = e.target.closest(".dew-chips button");
    if (!b) return;
    if (b.textContent === L[lang].retry) return retryAi();
    handle(b.textContent);
  });
  $("dew-langs").onclick = e => {
    const b = e.target.closest("[data-lang]"); if (!b) return;
    setLang(b.dataset.lang);
  };
  renderLangs();
}

function setLang(l, auto = false) {
  if (!L[l] || l === lang) return;
  lang = l; localStorage.setItem("biooasis-dew-lang", lang);
  if (window.bioI18n && window.bioI18n.lang !== l) window.bioI18n.set(l);
  renderLangs(); $("dew-input").placeholder = L[lang].placeholder;
  // The transcript and session context are kept: every message re-renders
  // in the new language, and a note makes the switch explicit in the log.
  history.push({ who: "note", msg: ll => auto ? L[ll].autoNote : L[ll].langNote });
  renderLog();
}

// Guess which of our three languages a transcript is in. Devanagari script is
// Hindi or Marathi (Marathi marker words decide); romanized Hindi/Marathi
// happens when the recognizer ran in English mode, so common roman words
// switch it back. Unsure stays with the current language.
function detectLang(t) {
  if (/[ऀ-ॿ]/u.test(t)) {
    const words = t.match(/[\p{L}\p{M}]+/gu) || [];
    const marathi = new Set(["आहे", "आहेत", "नाही", "मी", "तू", "तुम्ही", "काय", "कसं", "कसा", "मला", "तुमचा", "तुमची", "तुमचे", "माझा", "माझी", "माझे", "माझ्या", "तुमच्या", "पाणी", "होय", "पाहिजे", "करतो", "करायचं", "कसे", "केव्हा", "कशी", "फवारायचे", "आणि", "वेळ"]);
    return words.some(w => marathi.has(w)) ? "mr" : "hi";
  }
  const words = (t.toLowerCase().match(/[a-z']+/g) || []);
  if (!words.length) return lang;
  const mr = new Set(["nako","kasa","kashi","kay","zala","zali","sanga","sangitla","majha","majhi","aahe","ahe","ahet","pahije","mhanje","tumcha","tumchi","kara","karat","naahi"]);
  const mrHits = words.filter(w => mr.has(w)).length;
  if (mrHits >= 1 && mrHits >= words.length * 0.2) return "mr";
  const hints = new Set(["kya","kyu","kyun","hai","hain","nahi","nahin","mujhe","mera","meri","mere","kaise","kaisa","kitna","kitni","paani","dhup","dhoop","accha","acha","theek","thik","batao","bata","chahiye","karna","karo","bolo","suno","aapka","aapki","tumhara","tumhari","hoon","sakta","sakti","kare","karen","kab","rakhna","rakho","lagana","dalna","bataye","bataiye","garam","thanda","kharab","zyada"]);
  const hits = words.filter(w => hints.has(w)).length;
  return hits >= 1 && hits >= words.length * 0.2 ? "hi" : "en";
}

function renderLangs() {
  $("dew-langs").innerHTML = [["en", "EN"], ["hi", "हिंदी"], ["mr", "मराठी"]]
    .map(([id, name]) => `<button class="chip-btn ${id === lang ? "on" : ""}" data-lang="${id}">${name}</button>`).join("");
}

function speak(text, ondone) {
  if (listening || !(snd.isEnabled() || voiceTurn)) { if (ondone) ondone(); return; }
  stopSpeaking();
  const lg = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" }[lang] || "en-IN";
  const parts = speechParts(spokenText(text, lang));
  const gen = ++speakGen;
  let index = 0;
  const fail = () => {
    if (gen !== speakGen) return;
    stopSpeaking();
    if (voiceMode) voiceSet("idle", L[lang].voiceUnavailable);
    else note(l => L[l].voiceUnavailable);
  };
  const next = () => {
    if (gen !== speakGen || listening) return;
    if (index >= parts.length) { if (ondone) ondone(); return; }
    const part = parts[index++];
    const id = `${gen}-${index}`;
    let settled = false;
    const complete = () => {
      if (settled || gen !== speakGen) return;
      settled = true;
      // Explicit breath between sentences; never resume after an interrupt.
      setTimeout(next, /[!?।.]$/.test(part) ? 300 : 140);
    };
    if (voiceMode) {
      voiceSet("speak", part);
      $("dv-mascot").innerHTML = mascot(speechMood(part));
    }
    if (bridge()) {
      window.BioDewSpeech.onmessage = ev => dispatchBridge(ev.data);
      nativeSpeakDone = { id, complete, fail };
      setTimeout(() => {
        if (nativeSpeakDone?.id === id && gen === speakGen) fail();
      }, 6000 + part.length * 140);
      try { window.BioDewSpeech.postMessage("speak\t" + lg + "\t" + id + "\t" + part); return; }
      catch { nativeSpeakDone = null; fail(); return; }
    }
    if (!("speechSynthesis" in window)) { fail(); return; }
    const u = new SpeechSynthesisUtterance(part);
    u.lang = lg;
    const voice = chooseVoice(speechSynthesis.getVoices(), lg);
    if (voice) u.voice = voice;
    u.rate = 0.96; u.pitch = 1.0;
    u.onend = complete;
    // A browser without a usable voice must not freeze the conversation: keep
    // the reply on screen and carry on. Cancels from an interrupt are ignored.
    u.onerror = e => {
      if (e && (e.error === "interrupted" || e.error === "canceled")) return;
      complete();
    };
    speechSynthesis.speak(u);
  };
  next();
}

function entryEl(entry) {
  const el = document.createElement("div");
  if (entry.who === "note") {
    el.className = "msg note";
    el.innerHTML = `<span class="dew-note">${txt(entry.msg)}</span>`;
  } else if (entry.who === "user") {
    el.className = "msg user";
    if (entry.img) {
      const im = document.createElement("img");
      im.className = "dew-photo"; im.src = entry.img; im.alt = String(entry.msg || "");
      el.appendChild(im);
    }
    const cap = document.createElement("span");
    cap.textContent = String(entry.msg).replace(/[<>&"]/g, "");
    el.appendChild(cap);
  } else {
    const chips = chipList(entry.chips);
    const chipHtml = chips ? `<span class="dew-chips">${chips.map(c => `<button class="chip-btn">${c}</button>`).join("")}</span>` : "";
    el.className = "msg dew";
    const tagHtml = entry.tag ? `<span class="dew-tag dew-tag-${entry.tag}">${entry.tag === "ai" ? L[lang].tagAi : L[lang].tagLocal}</span>` : "";
    el.innerHTML = `<span class="mdew">${mascot("hello", "mini")}</span><span class="dew-body"><span>${txt(entry.msg)}</span>${tagHtml}${chipHtml}</span>`;
  }
  return el;
}

function append(entry) {
  $("dew-log").appendChild(entryEl(entry));
  if (history.length > 2) document.querySelector(".dewcol")?.classList.add("chatting");
  $("dew-log").scrollTop = $("dew-log").scrollHeight;
}

function renderLog() {
  const log = $("dew-log");
  log.innerHTML = "";
  history.forEach(e => log.appendChild(entryEl(e)));
  log.scrollTop = log.scrollHeight;
}

function say(msg, chips = null, tag = null, quiet = false, spoken = null) {
  const entry = { who: "dew", msg, chips, tag };
  history.push(entry);
  append(entry);
  if (quiet) return;
  const t = txt(voiceMode && spoken ? spoken : msg);
  lastSpoke = String(t);
  if (voiceMode) voiceSet("speak", lastSpoke);
  speak(t, onVoiceSpoke);
}

function note(msg) {
  const entry = { who: "note", msg };
  history.push(entry);
  append(entry);
}

function userSay(text, img) {
  const entry = { who: "user", msg: text, img: img || null };
  history.push(entry);
  append(entry);
}

function open() {
  ctx.showDew();
  $("dew-input").placeholder = L[lang].placeholder;
  if (!history.length) say(l => L[l].greet, l => L[l].chips);
  snd.step();
}

function sendText() {
  const t = $("dew-input").value.trim();
  if (!t) return;
  $("dew-input").value = "";
  handle(t);
}

function thinkingBubble() {
  const el = document.createElement("div");
  el.className = "msg dew";
  el.innerHTML = `<span class="mdew">${mascot("think", "mini")}</span><span>…</span>`;
  $("dew-log").appendChild(el);
  $("dew-log").scrollTop = $("dew-log").scrollHeight;
  return () => { if (el.isConnected) el.remove(); };
}

function listeningBubble() {
  const el = document.createElement("div");
  el.className = "msg dew";
  el.innerHTML = `<span class="mdew">${mascot("think", "mini")}</span><span>${L[lang].listening}</span>`;
  $("dew-log").appendChild(el);
  $("dew-log").scrollTop = $("dew-log").scrollHeight;
  return () => { if (el.isConnected) el.remove(); };
}

// How many mic attempts in a row caught nothing. A real conversation does
// not repeat the same "I can't hear you" line; it says it once, then gets
// quieter and points at typing instead.
let missCount = 0;

function misheard() {
  missCount++;
  if (missCount === 1) say(l => L[l].noMatch);
  else if (missCount === 2) say(l => L[l].noMatchAgain, null, null, true);
  else note(l => L[l].noMatchAgain);
  // Voice mode: after the first spoken retry the loop stops and waits for a tap.
  if (voiceMode && missCount >= 2) voiceSet("idle", txt(L[lang].vIdle));
}

function heard(text) {
  // Speaker echo right after Dew talked is not a user turn: drop it, keep listening.
  if (voiceMode && isEcho(text)) { beginListening(); return; }
  missCount = 0;
  setLang(detectLang(text), true);
  voiceTurn = true;
  if (voiceMode) voiceSet("think", String(text));
  // Her own words appear as her own message, like any chat - no "I heard:"
  // prefix announcing the transcription.
  userSay(text);
  reply(text);
}

/* ---- Immersive voice mode -------------------------------------------------
   A mic tap opens a full-screen stage where only Dew is present: listening
   rings while you talk, a thinking state, then Dew talking back with the
   reply as a caption. When Dew finishes, it listens again (after a beat, so
   its own voice does not feed the mic). The chat transcript keeps recording
   underneath, so leaving voice mode loses nothing. */

let listening = false;
let voiceMode = false;
let recogHandler = null;      // native recognition session in flight
let activeRecog = null;       // browser SpeechRecognition in flight
let bubbleDone = null;        // removes the chat "Listening..." bubble
let wantAbort = false;        // we stopped recognition on purpose
let speakGen = 0;             // interrupt generation for speech callbacks
let nativeSpeakDone = null;   // resolves the current native utterance
let lastSpoke = "";           // Dew's latest spoken line (echo guard)

const bridge = () => !!(window.BioDewSpeech && typeof window.BioDewSpeech.postMessage === "function");

function voiceSet(state, caption) {
  if (!voiceMode) return;
  $("dv-stage").dataset.state = state;
  $("dv-mascot").innerHTML = mascot(state === "think" ? "think" : state === "speak" ? "happy" : "hello");
  $("dv-status").textContent = { listen: L[lang].listening, think: L[lang].vThink, speak: L[lang].vSpeak, idle: L[lang].vIdle }[state] || "";
  if (caption !== undefined) $("dv-caption").textContent = caption;
}

function enterVoice() {
  voiceMode = true;
  $("dew-voice").classList.remove("hidden");
}

function exitVoice() {
  if (!voiceMode) return;
  voiceMode = false;          // first: pending callbacks become no-ops
  $("dew-voice").classList.add("hidden");
  stopSpeaking();
  stopActiveRecognition();
}

function dvMic() {
  if (listening) { stopActiveRecognition(); voiceSet("idle"); return; }
  mic();
}

function stopSpeaking() {
  speakGen++;                 // an interrupt invalidates pending speech callbacks
  nativeSpeakDone = null;
  try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch { /* ignore */ }
  if (bridge()) {
    try { window.BioDewSpeech.postMessage("stopspeak"); } catch { /* ignore */ }
  }
}

// All native bridge traffic flows through one dispatcher: speech completion
// drives the conversation loop, partial transcripts feed the live caption,
// and the rest belongs to the recognition session in flight.
function dispatchBridge(data) {
  const { kind, val } = parseWire(data);
  if (kind === "speakdone" || kind === "speakerror") {
    const pending = nativeSpeakDone;
    if (!pending || pending.id !== val) return; // stale/cancelled turn
    nativeSpeakDone = null;
    if (kind === "speakdone") pending.complete(); else pending.fail();
    return;
  }
  if (kind === "partial") { if (voiceMode && listening) voiceSet("listen", val); return; }
  if (recogHandler) recogHandler(kind, val);
}

function beginListening() {
  const langTag = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" }[lang];
  wantAbort = false;
  bubbleDone = listeningBubble();
  listening = true;
  voiceSet("listen", "");
  const stopListening = () => {
    listening = false;
    const d = bubbleDone; bubbleDone = null;
    if (d) d();
  };
  // Inside the Android app, the native bridge uses the phone's speech
  // recognizer (it may use the provider's network service). In browsers, the
  // Web Speech API. Either way: listening starts only on a mic tap.
  if (bridge()) {
    window.BioDewSpeech.onmessage = ev => dispatchBridge(ev.data);
    recogHandler = (kind, val) => {
      const c = classify(kind);
      recogHandler = null;
      stopListening();
      if (c === "result") { if (val.trim()) heard(val); else voiceSet("idle"); return; }
      if (c === "cancelled") { voiceSet("idle"); return; }
      if (c === "noMic") { say(l => L[l].noMic); return; }
      misheard();
    };
    try { window.BioDewSpeech.postMessage("start\t" + langTag); }
    catch { recogHandler = null; stopListening(); say(l => L[l].noMic); }
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { stopListening(); say(l => L[l].noMic); return; }
  const r = new SR();
  activeRecog = r;
  r.lang = langTag;
  r.interimResults = true;    // live captions while she talks
  r.onresult = e => {
    const res = e.results[e.results.length - 1];
    if (!res.isFinal) { voiceSet("listen", res[0].transcript); return; }
    activeRecog = null;
    stopListening();
    heard(res[0].transcript);
  };
  r.onerror = e => {
    activeRecog = null;
    stopListening();
    if (wantAbort) { wantAbort = false; voiceSet("idle"); return; }
    if (e && (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture")) say(l => L[l].noMic);
    else if (e && e.error === "network") say(l => L[l].noNet);
    else misheard();
  };
  r.onend = () => {
    // Recognition ended with no result and no error (silence, or the browser
    // gave up): never leave the stage stuck on "Listening".
    const was = listening;
    activeRecog = null;
    stopListening();
    if (!was) return;
    if (wantAbort) { wantAbort = false; voiceSet("idle"); return; }
    misheard();
  };
  try { r.start(); } catch { activeRecog = null; stopListening(); say(l => L[l].noMic); }
}

function stopActiveRecognition() {
  if (!listening) return;
  wantAbort = true;
  if (bridge()) {
    try { window.BioDewSpeech.postMessage("stop"); } catch { /* ignore */ }
    recogHandler = null;
    listening = false;
    const d = bubbleDone; bubbleDone = null;
    if (d) d();
    return;
  }
  try { if (activeRecog) (activeRecog.abort || activeRecog.stop).call(activeRecog); } catch { /* ignore */ }
}

// Dew finished a spoken turn: in voice mode, hand the floor back after a
// beat. Outside voice mode this is a no-op.
function onVoiceSpoke() {
  if (!voiceMode) return;
  voiceSet("idle");
  const gen = speakGen;
  setTimeout(() => { if (gen === speakGen && voiceMode && !listening && !busy) beginListening(); }, 700);
}

// Speaker output can echo back into the mic right after Dew talks. If the
// transcript is just Dew's own last line, drop it and keep listening.
function isEcho(t) {
  if (!lastSpoke) return false;
  const norm = x => String(x).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const a = norm(t), b = norm(lastSpoke);
  return a.length > 12 && (b.includes(a) || a.includes(b));
}

// A mic tap is also the interrupt button: it ALWAYS stops Dew talking,
// even while an answer is still being fetched.
function mic() {
  stopSpeaking();
  if (busy) return;
  snd.tap();
  enterVoice();
  beginListening();
}

export async function handlePhoto(file) {
  open();
  const url = URL.createObjectURL(file);
  chatPhotoUrls.add(url);
  userSay(L[lang].photoSent, url);
  say(l => L[l].scanning);
  try {
    const text = await readLabel(file, () => {}, () => {});
    if (!text || text.trim().length < 30) return say(l => L[l].unknown);
    const res = await api.analyze({ text });
    if (res.status !== "found") return say(l => L[l].unknown);
    ctx.onAnalyzed(text, res);
    say(l => L[l].afterResult(res.evidence.name), l => [L[l].seeResult, L[l].chips[3]]);
  } catch { say(l => L[l].unknown); }
}

function reply(text) {
  const t = text.trim();
  // Follow the language of this message, typed or spoken: when it is clearly
  // Hindi/Marathi (script or romanized), switch so the answer, the chips and
  // the voice all match. Unsure stays with the chosen language.
  setLang(detectLang(t), true);
  const c = ctx.getContext();
  if (t === L[lang].retry && lastQuestion) return retryAi();
  // follow-up buttons that mirror the chips
  if (t === L[lang].chips[0]) return say(l => L[l].what);
  if (t === L[lang].chips[1]) return say(l => (SUN_FACT[c.cls] || SUN_FACT.other)[l]);
  if (t === L[lang].chips[2]) { say(l => L[l].needScan); return ctx.openScan(); }
  if (t === L[lang].chips[3] || t === L[lang].mixLead) { say(l => L[l].mixLead); return ctx.openMix(); }
  if (t === L[lang].seeResult) return ctx.openResult();

  // correction: "no, it's BlightBan" / "actually it is T34" -> remember the name
  const corr = t.match(/(?:no,?\s*(?:it'?s|it is)|actually,?\s*(?:it'?s|it is))\s+(.{2,60})/i);
  if (corr) {
    const name = corr[1].trim();
    ctx.onCorrection(name);
    return say(l => L[l].corrected(name));
  }
  const intent = guideIntent(t);
  switch (intent) {
    case "greet": return say(l => L[l].greet, l => L[l].chips);
    case "what": return say(l => L[l].what);
    case "thanks": return say(l => L[l].thanks);
    case "sun": return say(l => (SUN_FACT[c.cls] || SUN_FACT.other)[l]);
    case "water": return say(l => WATER_FACT[l]);
    case "scan": say(l => L[l].needScan); return ctx.openScan();
    case "mix": say(l => L[l].mixLead); return ctx.openMix();
    default: {
      // context-aware follow-ups: expiry mention after a mix check
      if (/expir|एक्स्पायरी|एक्सपायरी|मुदत/i.test(t) && c.mixExpiry) return say(l => L[l].expiryOn(c.mixExpiry));
      // Grounded caterpillar/Bt conversation, answered from the app's own
      // cited evidence - works even when Dew AI is unreachable.
      if (pestIntent(t)) { lastTopic = "bt"; return say(l => PEST_FACT[l], l => [PEST_CHIP[l]], null, false, l => VOICE_PEST[l]); }
      if (btIntent(t)) { lastTopic = "bt"; return say(l => BT_FACT[l], null, null, false, l => VOICE_BT[l]); }
      if (sprayHowIntent(t, lastTopic === "bt")) {
        // A procedure question naming a non-Bt product class (weedicide,
        // fungicide...) must not get the Bt guide - it is an open question.
        if (nonBtProductIntent(t)) { lastTopic = null; return aiReply(t); }
        return lastTopic === "bt" ? say(l => SPRAY_GUIDE[l], null, null, false, l => VOICE_GUIDE[l]) : say(l => L[l].whichProduct);
      }
      return aiReply(t);
    }
  }
}

function handle(text) { voiceTurn = false; userSay(text); reply(text); }

// The Retry chip after an AI connection failure: ask the same question again
// without printing a new user bubble. Genuine "I don't know" answers never
// get a Retry - only connection failures do.
function retryAi() {
  if (busy || !lastQuestion) return;
  snd.tap();
  aiReply(lastQuestion);
}

let aiNoticeShown = false;
let aiOffNoted = false;

// Free-form questions go to Gemini through the bioOasis backend (the key never
// touches the app). A connection failure is NOT "I don't have evidence": it
// gets a clear connection message with a Retry chip. The no-evidence line is
// kept for genuine uncertainty only. Gemini answers carry a "Dew AI" tag,
// guide answers carry a "built-in guide" tag.
async function aiReply(text) {
  if (api.getMode() !== "api") {
    if (!aiOffNoted) { aiOffNoted = true; note(l => L[l].aiOff); }
    return say(l => L[l].fallback, l => L[l].chips, "local");
  }
  if (!aiNoticeShown) { aiNoticeShown = true; note(l => L[l].aiNotice); }
  busy = true;
  lastQuestion = text;
  const done = thinkingBubble();
  // Quota exhaustion offers no Retry chip (retrying today will fail again);
  // other connection failures do.
  // An error is shown, never spoken as if it were Dew's answer.
  const failed = (quota = false) => {
    say(l => quota ? L[l].quotaMsg : L[l].aiDownMsg,
      l => quota ? L[l].chips : [L[l].retry, ...L[l].chips], null, true);
    if (voiceMode) voiceSet("idle", txt(quota ? L[lang].quotaMsg : L[lang].aiDownMsg));
  };
  try {
    const c = ctx.getContext();
    const hist = history.filter(h => h.who !== "note").slice(-8)
      .map(h => ({ role: h.who === "user" ? "user" : "model", text: String(txt(h.msg, "en") || "") }));
    const res = await api.dewChat({ message: text, lang: detectLang(text), history: hist,
      context: { name: c.name || null, cls: c.cls || null, facts: c.facts || [], mix: c.mix || null } });
    done();
    const answer = res && res.reply;
    if (answer && answer.trim()) say(answer.trim(), null, "ai");
    else failed();
  } catch (e) {
    done();
    failed(Boolean(e && e.status === 429));
  }
  busy = false;
}
