import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

export default function LeavesScreen() {
  const { t } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState('Sick Leave');

  const leaveTypes = [
    { id: 'Sick Leave', label: t('leave.sick'), icon: '🤒' },
    { id: 'Casual Leave', label: t('leave.casual'), icon: '🏖️' },
    { id: 'Paid Leave', label: t('leave.paid'), icon: '💰' },
  ];

  const mockLeaves = [
    { id: 1, type: 'Sick Leave', start: '2025-04-05', end: '2025-04-06', status: 'approved', reason: 'Fever' },
    { id: 2, type: 'Casual Leave', start: '2025-03-20', end: '2025-03-20', status: 'pending', reason: 'Personal work' },
  ];

  const statusColors: Record<string, string> = {
    approved: '#10b981',
    pending: '#f59e0b',
    rejected: '#ef4444',
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('leave.title')}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowForm(!showForm)}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={20} color="#fff" />
          {!showForm && <Text style={styles.addButtonText}>{t('leave.apply')}</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container}>
        {/* Apply Leave Form */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{t('leave.apply')}</Text>

            <Text style={styles.label}>{t('leave.type')}</Text>
            <View style={styles.leaveTypeRow}>
              {leaveTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.leaveTypeChip,
                    selectedType === type.id && styles.leaveTypeChipSelected,
                  ]}
                  onPress={() => setSelectedType(type.id)}
                >
                  <Text>{type.icon}</Text>
                  <Text style={[styles.leaveTypeText, selectedType === type.id && styles.leaveTypeTextSelected]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t('leave.startDate')}</Text>
                <TextInput style={styles.input} placeholder="YYYY-MM-DD" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t('leave.endDate')}</Text>
                <TextInput style={styles.input} placeholder="YYYY-MM-DD" />
              </View>
            </View>

            <Text style={styles.label}>{t('leave.reason')}</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder={t('leave.reason')}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity style={styles.submitButton}>
              <Text style={styles.submitButtonText}>{t('leave.submit')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* My Leaves List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('leave.myLeaves')}</Text>
          {mockLeaves.map((leave) => (
            <View key={leave.id} style={styles.leaveCard}>
              <View style={styles.leaveHeader}>
                <View style={styles.leaveType}>
                  <Text style={styles.leaveTypeIcon}>
                    {leaveTypes.find((t) => t.id === leave.type)?.icon || '📄'}
                  </Text>
                  <Text style={styles.leaveTypeName}>{leave.type}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColors[leave.status] }]}>
                  <Text style={styles.statusText}>{leave.status}</Text>
                </View>
              </View>
              <Text style={styles.leaveDates}>
                {leave.start} → {leave.end}
              </Text>
              {leave.reason && <Text style={styles.leaveReason}>{leave.reason}</Text>}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a237e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  formCard: {
    margin: 16,
    marginTop: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  formTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#f9fafb',
  },
  row: { flexDirection: 'row', gap: 12 },
  leaveTypeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  leaveTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  leaveTypeChipSelected: { backgroundColor: 'rgba(26,35,126,0.1)', borderWidth: 1, borderColor: '#1a237e' },
  leaveTypeText: { fontSize: 12, color: '#6b7280' },
  leaveTypeTextSelected: { color: '#1a237e', fontWeight: '600' },
  submitButton: {
    backgroundColor: '#1a237e',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  section: { padding: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 12 },
  leaveCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  leaveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  leaveType: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leaveTypeIcon: { fontSize: 18 },
  leaveTypeName: { fontSize: 14, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  leaveDates: { fontSize: 13, color: '#6b7280' },
  leaveReason: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
});
