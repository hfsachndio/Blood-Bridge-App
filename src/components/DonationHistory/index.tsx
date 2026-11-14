import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../utils/color';
import { karma } from '../../assets/fonts/fonts';
import { scale, verticalScale } from '../../utils/globalFunction';
import { images } from '../../assets/png/images';
import { getDonationsCollection, getRequestsCollection } from '../../config/firebase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DonationHistoryItem = {
  id: string;
  type: 'donation' | 'sos';
  date: string;
  hospital?: string;
  location?: string;
  bloodType?: string;
  status?: string;
  priority?: string;
  unitsNeeded?: number;
};

type Props = {
  donations: DonationHistoryItem[];   // donation posts
  sosRequests: DonationHistoryItem[]; // sos/urgent requests
  onViewAll?: () => void;
  onItemDeleted?: () => void;         // callback to refresh parent after delete
  previewCount?: number;              // how many to preview (default 3)
};

// ─── Priority colour helper ───────────────────────────────────────────────────
const priorityColor = (p?: string) => {
  if (p === 'critical') return '#dc2626';
  if (p === 'urgent') return '#ea580c';
  return '#2563eb';
};

// ─── Single item card ─────────────────────────────────────────────────────────
const HistoryCard = ({
  item,
  onDelete,
}: {
  item: DonationHistoryItem;
  onDelete: (item: DonationHistoryItem) => void;
}) => {
  const isSOS = item.type === 'sos';

  return (
    <View style={[styles.card, isSOS && styles.cardSOS]}>
      {/* Left icon */}
      <View style={[styles.iconBox, isSOS && styles.iconBoxSOS]}>
        <Image
          source={isSOS ? images.heartfill : images.dropleticon}
          style={styles.icon}
          tintColor={isSOS ? '#ea580c' : COLORS.red600}
          resizeMode="contain"
        />
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.hospital || item.location || (isSOS ? 'SOS Request' : 'Donation Post')}
          </Text>
          {item.bloodType ? (
            <View style={[styles.bloodBadge, isSOS && styles.bloodBadgeSOS]}>
              <Text style={styles.bloodText}>{item.bloodType}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.dateText}>{item.date}</Text>

        <View style={styles.tagsRow}>
          {/* Status / Priority tag */}
          {isSOS && item.priority ? (
            <View style={[styles.tag, { backgroundColor: priorityColor(item.priority) + '22', borderColor: priorityColor(item.priority) }]}>
              <Text style={[styles.tagText, { color: priorityColor(item.priority) }]}>
                {item.priority?.toUpperCase()}
              </Text>
            </View>
          ) : (
            <View style={[styles.tag, item.status === 'active' ? styles.tagActive : styles.tagDone]}>
              <Text style={[styles.tagText, item.status === 'active' ? styles.tagActiveText : styles.tagDoneText]}>
                {item.status === 'active' ? '● Active' : '✓ Closed'}
              </Text>
            </View>
          )}

          {isSOS && item.unitsNeeded ? (
            <Text style={styles.unitsText}>Units: {item.unitsNeeded}</Text>
          ) : null}
        </View>
      </View>

      {/* Delete / Close button */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => onDelete(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const DonationHistory = ({
  donations = [],
  sosRequests = [],
  onViewAll,
  onItemDeleted,
  previewCount = 3,
}: Props) => {
  const [activeTab, setActiveTab] = useState<'donation' | 'sos'>('donation');
  const [deleting, setDeleting] = useState<string | null>(null);

  const activeData = activeTab === 'donation' ? donations : sosRequests;
  const preview = activeData.slice(0, previewCount);
  const hasMore = activeData.length > previewCount;

  // ─── Delete handler ─────────────────────────────────────────────────────────
  const handleDelete = (item: DonationHistoryItem) => {
    Alert.alert(
      item.type === 'sos' ? 'Close SOS Request' : 'Close Donation Post',
      'This will permanently delete this post. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(item.id);
            try {
              if (item.type === 'sos') {
                await getRequestsCollection().doc(item.id).delete();
              } else {
                await getDonationsCollection().doc(item.id).delete();
              }
              onItemDeleted?.();
            } catch (e) {
              console.log('Delete error:', e);
              Alert.alert('Error', 'Failed to delete. Please try again.');
            } finally {
              setDeleting(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>My Activity</Text>
        {(donations.length + sosRequests.length) > previewCount && (
          <TouchableOpacity onPress={onViewAll}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Summary chips ── */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryCount}>{donations.length}</Text>
          <Text style={styles.summaryLabel}>Donation Posts</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={[styles.summaryChip, styles.summaryChipSOS]}>
          <Text style={[styles.summaryCount, { color: '#ea580c' }]}>{sosRequests.length}</Text>
          <Text style={styles.summaryLabel}>SOS Requests</Text>
        </View>
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'donation' && styles.tabActive]}
          onPress={() => setActiveTab('donation')}>
          <Text style={[styles.tabText, activeTab === 'donation' && styles.tabTextActive]}>
            🩸 Donations ({donations.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sos' && styles.tabActive, activeTab === 'sos' && styles.tabActiveSOS]}
          onPress={() => setActiveTab('sos')}>
          <Text style={[styles.tabText, activeTab === 'sos' && styles.tabTextActive]}>
            🚨 SOS ({sosRequests.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Items ── */}
      {activeData.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>{activeTab === 'donation' ? '🩸' : '🚨'}</Text>
          <Text style={styles.emptyText}>
            {activeTab === 'donation'
              ? 'No donation posts yet.'
              : 'No SOS requests yet.'}
          </Text>
        </View>
      ) : (
        <>
          {preview.map(item =>
            deleting === item.id ? (
              <View key={item.id} style={styles.deletingRow}>
                <ActivityIndicator size="small" color={COLORS.red600} />
                <Text style={styles.deletingText}>Deleting...</Text>
              </View>
            ) : (
              <HistoryCard key={item.id} item={item} onDelete={handleDelete} />
            ),
          )}

          {hasMore && (
            <TouchableOpacity style={styles.viewAllBtn} onPress={onViewAll}>
              <Text style={styles.viewAllBtnText}>
                View All {activeData.length} {activeTab === 'donation' ? 'Donations' : 'SOS Requests'} →
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
};

export default DonationHistory;

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    margin: scale(15),
    marginTop: scale(8),
    borderRadius: scale(14),
    paddingHorizontal: scale(15),
    paddingVertical: verticalScale(15),
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  title: {
    fontSize: scale(16),
    fontFamily: karma.f700,
    color: COLORS.gray900,
  },
  viewAllText: {
    fontSize: scale(13),
    fontFamily: karma.f500,
    color: COLORS.red600,
  },
  // Summary row
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: scale(10),
    padding: scale(12),
    marginBottom: verticalScale(12),
    alignItems: 'center',
  },
  summaryChip: {
    flex: 1,
    alignItems: 'center',
  },
  summaryChipSOS: {},
  summaryDivider: {
    width: 1,
    height: verticalScale(30),
    backgroundColor: COLORS.gray300,
  },
  summaryCount: {
    fontSize: scale(22),
    fontFamily: karma.f700,
    color: COLORS.red600,
  },
  summaryLabel: {
    fontSize: scale(11),
    fontFamily: karma.f400,
    color: COLORS.slate500,
    marginTop: verticalScale(2),
  },
  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: scale(8),
    padding: scale(3),
    marginBottom: verticalScale(12),
    gap: scale(3),
  },
  tab: {
    flex: 1,
    paddingVertical: verticalScale(7),
    alignItems: 'center',
    borderRadius: scale(6),
  },
  tabActive: {
    backgroundColor: COLORS.red600,
  },
  tabActiveSOS: {
    backgroundColor: '#ea580c',
  },
  tabText: {
    fontSize: scale(12),
    fontFamily: karma.f500,
    color: COLORS.gray700,
  },
  tabTextActive: {
    color: COLORS.white,
    fontFamily: karma.f600,
  },
  // Cards
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(10),
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: scale(10),
    padding: scale(10),
    marginBottom: verticalScale(8),
    backgroundColor: COLORS.white,
  },
  cardSOS: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff7f7',
  },
  iconBox: {
    backgroundColor: COLORS.red100,
    width: scale(34),
    height: verticalScale(34),
    borderRadius: scale(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBoxSOS: {
    backgroundColor: '#ffedd5',
  },
  icon: {
    width: scale(16),
    height: verticalScale(16),
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(2),
  },
  cardTitle: {
    fontSize: scale(13),
    fontFamily: karma.f600,
    color: COLORS.gray900,
    flex: 1,
    marginRight: scale(6),
  },
  bloodBadge: {
    backgroundColor: COLORS.red600,
    borderRadius: scale(4),
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(1),
  },
  bloodBadgeSOS: {
    backgroundColor: '#ea580c',
  },
  bloodText: {
    color: COLORS.white,
    fontSize: scale(10),
    fontFamily: karma.f700,
  },
  dateText: {
    fontSize: scale(11),
    fontFamily: karma.f400,
    color: COLORS.slate500,
    marginBottom: verticalScale(4),
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  tag: {
    borderRadius: scale(4),
    borderWidth: 1,
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(1),
  },
  tagActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  tagDone: {
    backgroundColor: COLORS.gray300 + '66',
    borderColor: COLORS.gray300,
  },
  tagText: {
    fontSize: scale(10),
    fontFamily: karma.f600,
  },
  tagActiveText: { color: '#15803d' },
  tagDoneText: { color: COLORS.slate500 },
  unitsText: {
    fontSize: scale(10),
    fontFamily: karma.f400,
    color: COLORS.gray700,
  },
  closeBtn: {
    width: scale(22),
    height: scale(22),
    borderRadius: scale(11),
    backgroundColor: COLORS.gray300,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: verticalScale(2),
  },
  closeBtnText: {
    fontSize: scale(10),
    color: COLORS.gray700,
    fontFamily: karma.f700,
  },
  // Deleting row
  deletingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    padding: scale(12),
    marginBottom: verticalScale(8),
  },
  deletingText: {
    fontSize: scale(13),
    color: COLORS.slate500,
    fontFamily: karma.f400,
  },
  // Empty state
  emptyBox: {
    alignItems: 'center',
    paddingVertical: verticalScale(16),
    gap: verticalScale(6),
  },
  emptyEmoji: {
    fontSize: scale(28),
  },
  emptyText: {
    fontSize: scale(13),
    color: COLORS.slate500,
    fontFamily: karma.f400,
  },
  // View All button
  viewAllBtn: {
    marginTop: verticalScale(4),
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: scale(8),
    paddingVertical: verticalScale(10),
    alignItems: 'center',
  },
  viewAllBtnText: {
    fontSize: scale(13),
    fontFamily: karma.f600,
    color: COLORS.red600,
  },
});
