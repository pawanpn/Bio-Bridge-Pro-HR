import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { useLanguage } from '../../src/context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

type SettingItemProps = {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
};

const SettingItem: React.FC<SettingItemProps> = ({ icon, label, value, onPress, switchValue, onSwitchChange }) => (
  <TouchableOpacity
    style={styles.settingItem}
    onPress={onPress}
    disabled={!onPress && !onSwitchChange}
  >
    <View style={styles.settingLeft}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon as any} size={20} color="#1a237e" />
      </View>
      <Text style={styles.settingLabel}>{label}</Text>
    </View>
    {switchValue !== undefined && onSwitchChange ? (
      <Switch value={switchValue} onValueChange={onSwitchChange} />
    ) : (
      <View style={styles.settingRight}>
        {value && <Text style={styles.settingValue}>{value}</Text>}
        {onPress && <Ionicons name="chevron-forward" size={20} color="#9ca3af" />}
      </View>
    )}
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const { t, language, setLanguage } = useLanguage();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>

      {/* Profile Section */}
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>A</Text>
        </View>
        <Text style={styles.profileName}>Admin User</Text>
        <Text style={styles.profileRole}>SUPER_ADMIN</Text>
      </View>

      {/* Language Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🌐 {t('settings.language')}</Text>
        <View style={styles.langRow}>
          <TouchableOpacity
            style={[styles.langChip, language === 'en' && styles.langChipSelected]}
            onPress={() => setLanguage('en')}
          >
            <Text style={[styles.langText, language === 'en' && styles.langTextSelected]}>
              {t('settings.english')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langChip, language === 'ne' && styles.langChipSelected]}
            onPress={() => setLanguage('ne')}
          >
            <Text style={[styles.langText, language === 'ne' && styles.langTextSelected]}>
              {t('settings.nepali')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Settings List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ {t('settings.title')}</Text>
        <SettingItem
          icon="calendar-outline"
          label={t('settings.calendar')}
          value={t('settings.bs')}
          onPress={() => {}}
        />
        <SettingItem
          icon="moon-outline"
          label="Dark Mode"
          switchValue={false}
          onSwitchChange={() => {}}
        />
        <SettingItem
          icon="notifications-outline"
          label="Push Notifications"
          switchValue={true}
          onSwitchChange={() => {}}
        />
        <SettingItem
          icon="shield-checkmark-outline"
          label="Security"
          onPress={() => {}}
        />
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ℹ️ {t('settings.about')}</Text>
        <SettingItem
          icon="information-circle-outline"
          label={t('settings.version')}
          value="1.0.0"
        />
        <SettingItem
          icon="document-text-outline"
          label="Terms & Privacy"
          onPress={() => {}}
        />
        <SettingItem
          icon="help-circle-outline"
          label="Help & Support"
          onPress={() => {}}
        />
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>{t('auth.logout')}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  header: { padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  profileSection: {
    margin: 16,
    marginTop: 0,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1a237e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  profileName: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  profileRole: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  section: { padding: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 12 },
  langRow: { flexDirection: 'row', gap: 12 },
  langChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  langChipSelected: { backgroundColor: 'rgba(26,35,126,0.1)', borderColor: '#1a237e' },
  langText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  langTextSelected: { color: '#1a237e', fontWeight: '700' },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 2,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(26,35,126,0.1)', justifyContent: 'center', alignItems: 'center' },
  settingLabel: { fontSize: 15, color: '#1f2937' },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingValue: { fontSize: 13, color: '#6b7280' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#ef4444' },
});
