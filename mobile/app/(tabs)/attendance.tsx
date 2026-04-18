import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

export default function AttendanceScreen() {
  const { t } = useLanguage();
  const [checkedIn, setCheckedIn] = useState(false);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('att.title')}</Text>
      </View>

      {/* Check In/Out Button */}
      <View style={styles.checkInCard}>
        <TouchableOpacity
          style={[styles.checkInButton, { backgroundColor: checkedIn ? '#ef4444' : '#10b981' }]}
          onPress={() => setCheckedIn(!checkedIn)}
        >
          <Ionicons name={checkedIn ? 'log-out' : 'log-in'} size={32} color="#fff" />
          <Text style={styles.checkInText}>
            {checkedIn ? t('att.checkOut') : t('att.checkIn')}
          </Text>
        </TouchableOpacity>
        <Text style={styles.checkInTime}>
          {checkedIn ? '09:15 AM' : '--:--'}
        </Text>
      </View>

      {/* Today's Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('att.todayStatus')}</Text>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            <Text style={[styles.summaryValue, { color: '#10b981' }]}>18</Text>
            <Text style={styles.summaryLabel}>{t('att.present')}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
            <Ionicons name="time" size={24} color="#f59e0b" />
            <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>3</Text>
            <Text style={styles.summaryLabel}>{t('att.late')}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
            <Ionicons name="close-circle" size={24} color="#ef4444" />
            <Text style={[styles.summaryValue, { color: '#ef4444' }]}>4</Text>
            <Text style={styles.summaryLabel}>{t('att.absent')}</Text>
          </View>
        </View>
      </View>

      {/* Attendance History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('att.history')}</Text>
        {['Apr 6', 'Apr 5', 'Apr 4', 'Apr 3', 'Apr 2'].map((date, i) => (
          <View key={date} style={styles.historyItem}>
            <View style={styles.historyLeft}>
              <Text style={styles.historyDate}>{date}, 2025</Text>
              <Text style={styles.historyDay}>
                {['Saturday', 'Friday', 'Thursday', 'Wednesday', 'Tuesday'][i]}
              </Text>
            </View>
            <View style={styles.historyRight}>
              <Text style={styles.historyTime}>08:45 - 17:30</Text>
              <View style={[styles.statusBadge, { backgroundColor: '#10b981' }]} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  header: { padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  checkInCard: {
    margin: 16,
    marginTop: 0,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  checkInText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  checkInTime: { fontSize: 16, color: '#6b7280', marginTop: 12 },
  section: { padding: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  summaryValue: { fontSize: 24, fontWeight: 'bold' },
  summaryLabel: { fontSize: 12, color: '#6b7280' },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  historyLeft: { flex: 1 },
  historyDate: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  historyDay: { fontSize: 12, color: '#6b7280' },
  historyRight: { alignItems: 'flex-end', flexDirection: 'row', gap: 8 },
  historyTime: { fontSize: 13, color: '#10b981', fontWeight: '500' },
  statusBadge: { width: 10, height: 10, borderRadius: 5 },
});
