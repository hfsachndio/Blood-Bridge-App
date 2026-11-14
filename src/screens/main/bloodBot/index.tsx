/**
 * BloodBot: an NLP chat assistant that understands English and Roman Urdu.
 * Finds compatible donors, posts SOS requests by conversation, answers eligibility questions.
 * Runs on-device (TF-IDF intent classifier + entity recognition, see src/nlp).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, StatusBar, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../../utils/color';
import { karma } from '../../../assets/fonts/fonts';
import { scale, verticalScale } from '../../../utils/globalFunction';
import { useUser } from '../../../context/UserContext';
import { BloodBot, type BotReply, type BotLink } from '../../../nlp/bot';
import { firebaseBotData } from '../../../nlp/firebaseData';

type Msg = { id: string; from: 'me' | 'bot'; reply: BotReply };

/** Renders **bold** markdown used by the bot's replies. */
const Rich = ({ text, style }: { text: string; style: any }) => (
  <Text style={style}>
    {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <Text key={i} style={{ fontFamily: karma.f700 }}>{part.slice(2, -2)}</Text>
        : <Text key={i}>{part}</Text>,
    )}
  </Text>
);

const initialsOf = (n: string) => n.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'U';

const BloodBotScreen = ({ navigation }: any) => {
  const { profile } = useUser();
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const bot = useMemo(() => new BloodBot(firebaseBotData(() => profileRef.current)), []);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showNlp, setShowNlp] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);

  useEffect(() => {
    setMessages([{ id: 'hello', from: 'bot', reply: bot.greeting() }]);
  }, [bot]);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput('');
    const mine: Msg = { id: `u${Date.now()}`, from: 'me', reply: { text } };
    setMessages((m) => [...m, mine]);
    setBusy(true);
    try {
      const reply = await bot.reply(text);
      setMessages((m) => [...m, { id: `b${Date.now()}`, from: 'bot', reply }]);
    } catch (e: any) {
      setMessages((m) => [...m, { id: `e${Date.now()}`, from: 'bot', reply: { text: `Something went wrong: ${e?.message ?? 'please try again'}.` } }]);
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const openLink = (l: BotLink) => navigation.navigate(l.screen, l.params);
  const openChat = (uid: string, name: string) => navigation.navigate('MessageScreen', { otherUserId: uid, name, initials: initialsOf(name) });

  const renderItem = ({ item, index }: { item: Msg; index: number }) => {
    const r = item.reply;
    const last = index === messages.length - 1;
    if (item.from === 'me') {
      return <View style={[styles.bubble, styles.mine]}><Text style={styles.mineText}>{r.text}</Text></View>;
    }
    return (
      <View style={styles.botRow}>
        <View style={styles.avatar}><Text style={styles.avatarText}>🤖</Text></View>
        <View style={{ flex: 1 }}>
          <View style={[styles.bubble, styles.theirs]}><Rich text={r.text} style={styles.theirsText} /></View>

          {r.donors?.map((d) => (
            <View key={d.uid} style={styles.card}>
              <View style={styles.badge}><Text style={styles.badgeText}>{d.bloodType}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{d.name}</Text>
                <Text style={styles.cardSub}>{[d.area, d.km, d.available ? (d.readyNow ? 'Ready to donate' : 'Available') : 'Unavailable'].filter(Boolean).join(' · ')}</Text>
              </View>
              <TouchableOpacity style={styles.smallBtn} onPress={() => openChat(d.uid, d.name)}><Text style={styles.smallBtnText}>Chat</Text></TouchableOpacity>
            </View>
          ))}

          {r.requests?.map((q) => (
            <View key={q.id} style={styles.card}>
              <View style={styles.badge}><Text style={styles.badgeText}>{q.bloodType}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{q.hospital}</Text>
                <Text style={styles.cardSub}>{q.name} · {q.units} unit(s) · {q.priority}</Text>
              </View>
              <TouchableOpacity style={styles.smallBtn} onPress={() => openChat(q.uid, q.name)}><Text style={styles.smallBtnText}>Respond</Text></TouchableOpacity>
            </View>
          ))}

          {r.links?.length ? (
            <View style={styles.wrap}>
              {r.links.map((l) => (
                <TouchableOpacity key={l.label} style={styles.link} onPress={() => openLink(l)}><Text style={styles.linkText}>{l.label} →</Text></TouchableOpacity>
              ))}
            </View>
          ) : null}

          {last && r.chips?.length ? (
            <View style={styles.wrap}>
              {r.chips.map((c) => (
                <TouchableOpacity key={c} style={styles.chip} onPress={() => send(c)}><Text style={styles.chipText}>{c}</Text></TouchableOpacity>
              ))}
            </View>
          ) : null}

          {showNlp && r.debug ? (
            <Text style={styles.debug}>
              intent: {r.debug.intent} ({Math.round(r.debug.confidence * 100)}%){'\n'}
              entities: {JSON.stringify({ ...r.debug.entities, place: r.debug.entities.place?.name })}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar backgroundColor={COLORS.white} barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}><Text style={styles.back}>‹</Text></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>BloodBot</Text>
          <Text style={styles.subtitle}>English & Roman Urdu · on-device NLP</Text>
        </View>
        <Text style={styles.nlpLabel}>NLP</Text>
        <Switch value={showNlp} onValueChange={setShowNlp} trackColor={{ false: COLORS.gray300, true: COLORS.red600 }} thumbColor={COLORS.white} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={busy ? <ActivityIndicator color={COLORS.red600} style={{ marginTop: 8 }} /> : null}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask in English or Roman Urdu…"
            placeholderTextColor={COLORS.slate500}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send()}
            returnKeyType="send"
          />
          <TouchableOpacity style={[styles.send, (!input.trim() || busy) && { opacity: 0.5 }]} onPress={() => send()} disabled={!input.trim() || busy}>
            <Text style={styles.sendText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default BloodBotScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: scale(10), paddingHorizontal: scale(16), paddingVertical: verticalScale(10), backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#eee' },
  back: { fontSize: scale(30), color: COLORS.gray900, marginTop: -4 },
  title: { fontFamily: karma.f700, fontSize: scale(18), color: COLORS.gray900 },
  subtitle: { fontFamily: karma.f400, fontSize: scale(12), color: COLORS.slate500 },
  nlpLabel: { fontFamily: karma.f600, fontSize: scale(12), color: COLORS.slate600 },
  list: { padding: scale(14), paddingBottom: verticalScale(20) },
  botRow: { flexDirection: 'row', gap: scale(8), marginBottom: verticalScale(12) },
  avatar: { width: scale(32), height: scale(32), borderRadius: scale(16), backgroundColor: COLORS.red100, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: scale(16) },
  bubble: { borderRadius: scale(16), paddingHorizontal: scale(12), paddingVertical: verticalScale(8), maxWidth: '88%' },
  mine: { alignSelf: 'flex-end', backgroundColor: COLORS.red600, marginBottom: verticalScale(12) },
  mineText: { color: COLORS.white, fontFamily: karma.f500, fontSize: scale(14) },
  theirs: { alignSelf: 'flex-start', backgroundColor: COLORS.white, maxWidth: '100%' },
  theirsText: { color: COLORS.gray900, fontFamily: karma.f400, fontSize: scale(14), lineHeight: scale(20) },
  card: { flexDirection: 'row', alignItems: 'center', gap: scale(10), backgroundColor: COLORS.white, borderRadius: scale(12), padding: scale(10), marginTop: verticalScale(6) },
  badge: { width: scale(38), height: scale(38), borderRadius: scale(10), backgroundColor: COLORS.red600, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: COLORS.white, fontFamily: karma.f700, fontSize: scale(13) },
  cardTitle: { fontFamily: karma.f600, fontSize: scale(14), color: COLORS.gray900 },
  cardSub: { fontFamily: karma.f400, fontSize: scale(12), color: COLORS.slate500 },
  smallBtn: { backgroundColor: COLORS.red600, borderRadius: scale(8), paddingHorizontal: scale(10), paddingVertical: verticalScale(6) },
  smallBtnText: { color: COLORS.white, fontFamily: karma.f600, fontSize: scale(12) },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(6), marginTop: verticalScale(6) },
  chip: { borderWidth: 1, borderColor: COLORS.red400, borderRadius: scale(14), paddingHorizontal: scale(10), paddingVertical: verticalScale(4), backgroundColor: COLORS.white },
  chipText: { color: COLORS.red600, fontFamily: karma.f500, fontSize: scale(12) },
  link: { backgroundColor: COLORS.red100, borderRadius: scale(10), paddingHorizontal: scale(10), paddingVertical: verticalScale(5) },
  linkText: { color: COLORS.red600, fontFamily: karma.f600, fontSize: scale(12) },
  debug: { marginTop: verticalScale(6), fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: scale(10), color: COLORS.slate600, backgroundColor: '#f1f5f9', padding: scale(6), borderRadius: scale(6) },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8), padding: scale(10), backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: '#eee' },
  input: { flex: 1, borderWidth: 1, borderColor: COLORS.gray300, borderRadius: scale(22), paddingHorizontal: scale(14), paddingVertical: verticalScale(8), fontFamily: karma.f400, fontSize: scale(14), color: COLORS.gray900 },
  send: { width: scale(42), height: scale(42), borderRadius: scale(21), backgroundColor: COLORS.red600, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: COLORS.white, fontSize: scale(18) },
});
