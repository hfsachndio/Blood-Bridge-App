# Blood Bridge: Mobile App (with BloodBot NLP)

**Blood Bridge** is a React Native and Firebase app for emergency blood donation in Karachi. It connects patients with nearby, compatible, CNIC-verified donors through SOS alerts, a donor map, chat and a points-based leaderboard.

This repository is my copy of the team's app. My addition is **BloodBot**, an on-device NLP assistant that understands **English and Roman Urdu**.

> **Credits:** the original app was built as a team project, and I was one of the contributors. The first commit in this repository is the team's original source. Every commit after it, including the NLP assistant, is my own work.
> Web version: **https://blood-bridge-opal.vercel.app** ([source](https://github.com/hfsachndio/blood-bridge-web))

![Blood Bridge screens](docs/real-screens.jpg)

## Features (team app)

- **Accounts and verification:** email sign-up and login, then a profile builder (CNIC with ML Kit text recognition, blood type, date of birth, weight). Accounts stay pending until an admin approves them.
- **SOS requests:** post an urgent request; donors are notified (Firebase Cloud Messaging plus an in-app feed) and can respond.
- **Search:** donation offers on Google Maps with blood-type and radius filters. Phone numbers stay hidden until the donor approves a contact request.
- **Chat:** real-time one-to-one messaging.
- **Donate:** post a donation offer with a location picked on the map.
- **Leaderboard and awards:** 100 points per offer and 150 per logged donation, plus badges.
- **Donation history, certificates and an eligibility checker** (WHO and Pakistan guidelines).
- **Admin dashboard** for reviewing CNIC submissions.

## BloodBot: NLP assistant (my addition)

You can open BloodBot from the **Ask BloodBot** card on the Home screen or from **Profile → Ask BloodBot**.

| Example | What happens |
|---|---|
| `meri ammi ko 2 bottle AB- chahiye indus hospital mein, critical` | It fills every SOS field from one sentence, asks you to confirm, then posts to Firestore and notifies compatible, available donors |
| `send an sos` → `B+` → `Aga Khan` → `2` → `urgent` | It asks for each missing field in turn; "cancel" stops it at any point |
| `koi O- donor hai Clifton mein?` | It lists compatible donors (exact match plus other compatible types), nearest first, with a **Chat** button |
| `I got a tattoo 2 months ago` / `I'm 17, can I donate?` | It answers from the same eligibility rules the app uses, with the numbers from your message |
| `show urgent requests` | It lists open requests you can donate to, with a **Respond** button |
| `mark me unavailable` | It updates your availability in Firestore |

The **NLP** switch in the header shows the detected intent, the confidence and the extracted entities for each message.

### How it works

Everything is plain TypeScript and runs on the device, with no external AI API and no extra dependencies.

| Stage | File |
|---|---|
| Normalisation: Roman Urdu to English lexicon, stop-words, light stemming | `src/nlp/text.ts` |
| Intent classification: TF-IDF over unigrams and bigrams, cosine k-NN against 250+ labelled phrases (29 intents), with a confidence threshold and an out-of-domain fallback | `src/nlp/classifier.ts` |
| Entity recognition: blood types, typo-tolerant Karachi areas and hospitals (Levenshtein distance), units (including Urdu numbers), age, weight, time since an event, urgency | `src/nlp/entities.ts` |
| Dialogue manager: SOS slot filling, follow-ups and actions | `src/nlp/bot.ts` |
| Firestore data source: the same collections as the rest of the app | `src/nlp/firebaseData.ts` |
| Chat screen | `src/screens/main/bloodBot/index.tsx` |

```bash
npm test -- src/nlp      # 7 tests: intents, entities, SOS dialogue, donor matching, eligibility
```

## Running the app

1. `npm install`
2. Create a Firebase project and put your own `android/app/google-services.json` in place; see `google-services.example.json`. The real config isn't committed.
3. `npm run android` (or `npm run ios`)

**Stack:** React Native 0.79, React 19, TypeScript, Firebase (Auth, Firestore, Storage, Messaging), React Navigation, react-native-maps and ML Kit text recognition.
