import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '../context/AuthContext';
import {
  Bell, Send, Trash2, Eye, CheckCheck, AlertCircle, Info,
  Calendar, Users, Globe, Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ── Types ───────────────────────────────────────────────────────────────────

interface Notification {
  id: number;
  senderName?: string;
  receiverType?: string;
  receiverId?: number;
  branchId?: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  expiresAt?: string;
}

interface Branch {
  id: number;
  name: string;
}

interface User {
  id: number;
  username: string;
  role: string;
}

type TabType = 'inbox' | 'sent' | 'compose' | 'all';

// ── Main Component ──────────────────────────────────────────────────────────

export const NotificationSystem: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  
  const [activeTab, setActiveTab] = useState<TabType>('inbox');
  const [myNotifications, setMyNotifications] = useState<Notification[]>([]);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Compose form
  const [composeForm, setComposeForm] = useState({
    title: '',
    message: '',
    receiverType: 'ALL' as 'USER' | 'BRANCH' | 'ALL',
    receiverId: null as number | null,
    branchId: null as number | null,
    notificationType: 'GENERAL' as 'GENERAL' | 'URGENT' | 'ANNOUNCEMENT' | 'REMINDER',
    expiresAt: '',
  });
  const [sendStatus, setSendStatus] = useState('');

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [notifications, count, branchData] = await Promise.all([
        invoke<any[]>('get_my_notifications'),
        invoke<number>('get_unread_count'),
        invoke<any[]>('list_branches'),
      ]);
      setMyNotifications(notifications);
      setUnreadCount(count);
      setBranches(branchData);
      
      if (isSuperAdmin) {
        const allNotifs = await invoke<any[]>('get_all_notifications');
        setAllNotifications(allNotifs);
        const userData = await invoke<any[]>('list_users');
        setUsers(userData);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Send notification
  const handleSend = async () => {
    if (!composeForm.title || !composeForm.message) {
      setSendStatus('❌ Title and message are required');
      return;
    }
    if (!user) {
      setSendStatus('❌ You must be logged in to send notifications');
      return;
    }
    setSendStatus('');
    try {
      // Parse user ID - handle both numeric and UUID formats
      const numericId = isNaN(parseInt(user.id)) ? null : parseInt(user.id);
      
      await invoke('send_notification', {
        title: composeForm.title,
        message: composeForm.message,
        receiverType: composeForm.receiverType,
        receiverId: composeForm.receiverType === 'USER' ? composeForm.receiverId : null,
        branchId: composeForm.receiverType === 'BRANCH' ? composeForm.branchId : null,
        notificationType: composeForm.notificationType,
        expiresAt: composeForm.expiresAt || null,
        senderId: numericId,
        senderName: user.full_name || user.username,
      });
      setSendStatus('✅ Notification sent successfully!');
      setComposeForm({
        title: '',
        message: '',
        receiverType: 'ALL',
        receiverId: null,
        branchId: null,
        notificationType: 'GENERAL',
        expiresAt: '',
      });
      loadData();
      setTimeout(() => setSendStatus(''), 3000);
    } catch (error) {
      setSendStatus('❌ Failed to send: ' + error);
    }
  };

  // Mark as read
  const handleMarkRead = async (id: number) => {
    try {
      await invoke('mark_notification_read', { id });
      loadData();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await invoke('mark_all_notifications_read');
      loadData();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Delete notification (Super Admin only)
  const handleDelete = async (id: number) => {
    if (!isSuperAdmin) return;
    try {
      await invoke('delete_notification', { id });
      loadData();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Get notification icon
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'URGENT':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'ANNOUNCEMENT':
        return <Globe className="w-5 h-5 text-blue-600" />;
      case 'REMINDER':
        return <Clock className="w-5 h-5 text-orange-600" />;
      default:
        return <Info className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Notification Center</h1>
          <p className="text-muted-foreground">
            Send and receive notifications across the organization
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="text-lg px-4 py-2">
            <Bell className="w-4 h-4 mr-2" />
            {unreadCount} Unread
          </Badge>
          {unreadCount > 0 && (
            <Button onClick={handleMarkAllRead} variant="outline" size="sm">
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-border">
        <TabButton
          icon={<Bell className="w-4 h-4" />}
          label={`Inbox (${unreadCount})`}
          active={activeTab === 'inbox'}
          onClick={() => setActiveTab('inbox')}
        />
        <TabButton
          icon={<Send className="w-4 h-4" />}
          label="Compose"
          active={activeTab === 'compose'}
          onClick={() => setActiveTab('compose')}
        />
        {isSuperAdmin && (
          <TabButton
            icon={<Eye className="w-4 h-4" />}
            label="All Notifications"
            active={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
          />
        )}
      </div>

      {/* Inbox Tab */}
      {activeTab === 'inbox' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading notifications...</div>
          ) : myNotifications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No notifications yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  When you receive notifications, they'll appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            myNotifications.map(notif => (
              <Card
                key={notif.id}
                className={`cursor-pointer transition-all ${
                  !notif.isRead ? 'border-primary/50 bg-primary/5' : ''
                }`}
                onClick={() => handleMarkRead(notif.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-semibold ${!notif.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {notif.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {notif.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(notif.createdAt)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>From: <strong>{notif.senderName}</strong></span>
                        {notif.expiresAt && (
                          <span>Expires: {new Date(notif.expiresAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    {!notif.isRead && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Compose Tab */}
      {activeTab === 'compose' && (
        <Card>
          <CardHeader>
            <CardTitle>Send Notification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-2xl space-y-6">
              {/* Receiver Type */}
              <div>
                <Label>Send To</Label>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setComposeForm({ ...composeForm, receiverType: 'ALL' })}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                      composeForm.receiverType === 'ALL'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Globe className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-sm font-medium">Everyone</span>
                  </button>
                  <button
                    onClick={() => setComposeForm({ ...composeForm, receiverType: 'BRANCH' })}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                      composeForm.receiverType === 'BRANCH'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Users className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-sm font-medium">Branch</span>
                  </button>
                  <button
                    onClick={() => setComposeForm({ ...composeForm, receiverType: 'USER' })}
                    className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                      composeForm.receiverType === 'USER'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Users className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-sm font-medium">User</span>
                  </button>
                </div>
              </div>

              {/* Branch Selector */}
              {composeForm.receiverType === 'BRANCH' && (
                <div>
                  <Label>Select Branch</Label>
                  <select
                    value={composeForm.branchId || ''}
                    onChange={(e) => setComposeForm({ ...composeForm, branchId: Number(e.target.value) || null })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm mt-1"
                  >
                    <option value="">Select Branch</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* User Selector */}
              {composeForm.receiverType === 'USER' && isSuperAdmin && (
                <div>
                  <Label>Select User</Label>
                  <select
                    value={composeForm.receiverId || ''}
                    onChange={(e) => setComposeForm({ ...composeForm, receiverId: Number(e.target.value) || null })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm mt-1"
                  >
                    <option value="">Select User</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notification Type */}
              <div>
                <Label>Notification Type</Label>
                <select
                  value={composeForm.notificationType}
                  onChange={(e) => setComposeForm({ ...composeForm, notificationType: e.target.value as any })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm mt-1"
                >
                  <option value="GENERAL">📋 General</option>
                  <option value="URGENT">🚨 Urgent</option>
                  <option value="ANNOUNCEMENT">📢 Announcement</option>
                  <option value="REMINDER">⏰ Reminder</option>
                </select>
              </div>

              {/* Title */}
              <div>
                <Label>Title</Label>
                <Input
                  value={composeForm.title}
                  onChange={(e) => setComposeForm({ ...composeForm, title: e.target.value })}
                  placeholder="Enter notification title"
                  className="mt-1"
                />
              </div>

              {/* Message */}
              <div>
                <Label>Message</Label>
                <Textarea
                  value={composeForm.message}
                  onChange={(e) => setComposeForm({ ...composeForm, message: e.target.value })}
                  placeholder="Enter notification message"
                  rows={5}
                  className="mt-1"
                />
              </div>

              {/* Expiry Date */}
              <div>
                <Label>Expires At (Optional)</Label>
                <Input
                  type="date"
                  value={composeForm.expiresAt}
                  onChange={(e) => setComposeForm({ ...composeForm, expiresAt: e.target.value })}
                  className="mt-1"
                />
              </div>

              {sendStatus && (
                <div className={`p-3 rounded-md ${
                  sendStatus.includes('❌') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                }`}>
                  {sendStatus}
                </div>
              )}

              <Button onClick={handleSend} size="lg">
                <Send className="w-4 h-4 mr-2" />
                Send Notification
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Notifications Tab (Super Admin) */}
      {activeTab === 'all' && isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>All Notifications</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Receiver</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : allNotifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No notifications found.
                    </TableCell>
                  </TableRow>
                ) : (
                  allNotifications.map(notif => (
                    <TableRow key={notif.id}>
                      <TableCell className="font-medium">{notif.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{notif.type}</Badge>
                      </TableCell>
                      <TableCell>{notif.senderName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {notif.receiverType === 'ALL' ? 'Everyone' :
                         notif.receiverType === 'BRANCH' ? `Branch #${notif.branchId}` :
                         `User #${notif.receiverId}`}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(notif.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={notif.isRead ? 'secondary' : 'default'}>
                          {notif.isRead ? 'Read' : 'Unread'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(notif.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ── Tab Button Component ────────────────────────────────────────────────────

const TabButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active
        ? 'border-primary text-primary'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`}
  >
    {icon}
    {label}
  </button>
);
