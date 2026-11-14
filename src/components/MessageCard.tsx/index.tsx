import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

import {COLORS} from '../../utils/color';
import {scale, verticalScale} from '../../utils/globalFunction';
import {karma} from '../../assets/fonts/fonts';

const MessageCard = ({initials, name, lastMessage, time, unread, navigation, otherUserId}: any) => {

  const handleMessageCard = () => {
    navigation.navigate('MessageScreen', {
      name,
      initials,
      otherUserId,
    });
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handleMessageCard}>
      <View style={styles.row}>
        <View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{name}</Text>
            </View>

            <View style={styles.timeRow}>
              <Text style={styles.time}>{time}</Text>
              {/* <MoreVertical size={16} color="#6b7280" /> */}
            </View>
          </View>

          <View style={styles.messageRow}>
            <Text
              style={[
                styles.message,
                unread > 0 ? styles.unread : styles.read,
              ]}>
              {lastMessage}
            </Text>

            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unread}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default MessageCard;

const styles = StyleSheet.create({
  card: {
    padding: scale(16),
    backgroundColor: COLORS.background,
    borderRadius: scale(12),
    marginBottom: verticalScale(10),
    borderLeftWidth: scale(4),
    borderLeftColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    gap: scale(12),
  },
  avatar: {
    height: verticalScale(48),
    width: scale(48),
    borderRadius: scale(30),
    backgroundColor: COLORS.red100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: scale(16),
    color: COLORS.red600,
    fontFamily: karma.f600,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  name: {
    fontSize: scale(16),
    color: COLORS.gray900,
    fontFamily: karma.f600,
  },
  typeBadge: {
    paddingHorizontal: scale(8),
    height: verticalScale(7),
    borderRadius: scale(6),
    fontSize: scale(12),
    fontFamily: karma.f500,
    overflow: 'hidden',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  time: {
    fontSize: scale(12),
    color: COLORS.slate500,
    fontFamily: karma.f500,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  message: {
    flex: 1,
    fontSize: scale(14),
    fontFamily: karma.f500,
  },
  unread: {
    color: COLORS.gray900,
  },
  read: {
    color: COLORS.slate500,
  },
  unreadBadge: {
    backgroundColor: COLORS.red600,
    paddingHorizontal: scale(8),
    borderRadius: scale(20),
    paddingVertical: verticalScale(2),
    marginLeft: scale(6),
  },
  unreadText: {
    color: COLORS.white,
    fontSize: scale(12),
    fontFamily: karma.f600,
  },
});
