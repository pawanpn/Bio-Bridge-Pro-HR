import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

interface StatCardProps {
  icon: string;
  label: string;
  value: number;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <View style={styles.statContent}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
    <Ionicons name={icon as any} size={28} color={color} />
  </View>
);

export default function DashboardScreen() {
  const { t } = useLanguage();

  // Mock data - replace with API calls
  const stats = {
    totalEmployees: 25,
    presentToday: 19,
    lateToday: 3,
    absent: 4,
    onLeave: 2,
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('dash.title')}</Text>
        <TouchableOpacity style={styles.syncButton}>
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.syncButtonText}>{t('dash.syncNow')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          icon="people"
          label={t('dash.totalEmployees')}
          value={stats.totalEmployees}
          color="#1a237e"
        />
        <StatCard
          icon="checkmark-circle"
          label={t('dash.presentToday')}
          value={stats.presentToday}
          color="#10b981"
        />
        <StatCard
          icon="time"
          label={t('dash.lateToday')}
          value={stats.lateToday}
          color="#f59e0b"
        />
        <StatCard
          icon="person-remove"
          label={t('dash.absent')}
          value={stats.absent}
          color="#ef4444"
        />
        <StatCard
          icon="calendar"
          label={t('dash.onLeave')}
          value={stats.onLeave}
          color="#3b82f6"
        />
      </View>

      {/* Today's Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('att.todayStatus')}</Text>
        <View style={styles.overviewCard}>
          <View style={styles.overviewRow}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>{t('att.present')}</Text>
              <Text style={[styles.overviewValue, { color: '#10b981' }]}>
                {((stats.presentToday / stats.totalEmployees) * 100).toFixed(0)}%
              </Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>{t('att.late')}</Text>
              <Text style={[styles.overviewValue, { color: '#f59e0b' }]}>
                {((stats.lateToday / stats.totalEmployees) * 100).toFixed(0)}%
              </Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>{t('att.absent')}</Text>
              <Text style={[styles.overviewValue, { color: '#ef4444' }]}>
                {((stats.absent / stats.totalEmployees) * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a237e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  syncButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  statsGrid: { padding: 16, gap: 12 },
  statCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statContent: { flex: 1 },
  statLabel: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: 'bold' },
  section: { padding: 16, paddingTop: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 12 },
  overviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  overviewRow: { flexDirection: 'row', justifyContent: 'space-around' },
  overviewItem: { alignItems: 'center' },
  overviewLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  overviewValue: { fontSize: 22, fontWeight: 'bold' },
});
