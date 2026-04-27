import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { AppConfig } from '../config/appConfig';
import { setCalendarModePreference } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Upload, CheckCircle2, Building2, Globe, Cloud, ArrowRight, ArrowLeft, Shield, FileText, UploadCloud } from 'lucide-react';

export const SetupWizard: React.FC = () => {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    authKey: '',
    companyName: '',
    address: '',
    contactInfo: '',
    licenseExpiry: '',
    defaultCalendar: 'BS',
    globalWeekend: 'Saturday',
    rootFolderId: AppConfig.defaultRootFolderId,
    serviceAccountEmail: '',
    jsonKeyText: '',
    hardwareId: 'Loading...',
  });

  const nextStep = () => setStep((s) => Math.min(s + 1, 5));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const fetchHardwareId = async () => {
    try {
      const id = await invoke<string>('get_hardware_id');
      setFormData(prev => ({ ...prev, hardwareId: id }));
    } catch (e) {
      console.error("Failed to fetch Hardware ID", e);
    }
  };

  React.useEffect(() => {
    fetchHardwareId();
  }, []);

  const handleVerify = async () => {
    if (!formData.jsonKeyText) {
      alert("Please upload your Service Account JSON key first.");
      return;
    }
    try {
      const expiry = await invoke<string>('activate_license_key', {
        key: formData.authKey,
        jsonKey: formData.jsonKeyText
      });
      setFormData({ ...formData, licenseExpiry: expiry });
      nextStep();
    } catch (e) {
      alert("Activation failed: " + e);
    }
  };

  const handleAdminGenerate = async () => {
    if (!formData.jsonKeyText) {
       alert("Upload JSON first to use Admin Tool.");
       return;
    }
    try {
      const keys = await invoke<string[]>('admin_generate_keys', {
        count: 5,
        expiry: '2027-12-31',
        jsonKey: formData.jsonKeyText
      });
      alert("Successfully generated 5 keys on Drive:\n\n" + keys.join('\n'));
    } catch (e) {
      alert("Admin failed: " + e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.client_email) {
        setFormData({
          ...formData,
          serviceAccountEmail: parsed.client_email,
          jsonKeyText: text
        });
      } else {
        alert("Invalid JSON: 'client_email' not found.");
      }
    } catch (err) {
      alert("Failed to read JSON file: " + err);
    }
  };

  const handleFinish = async () => {
    try {
      // 1. Save Company Info
      await invoke('save_company_info', {
        name: formData.companyName,
        address: formData.address,
        contact: formData.contactInfo,
        authKey: formData.authKey,
      });

      // 2. Save Cloud Credentials (if key provided)
      if (formData.jsonKeyText) {
        await invoke('save_cloud_credentials', {
           jsonContent: formData.jsonKeyText,
           rootFolderId: formData.rootFolderId
        });
      }

      // 3. Mark setup complete
      localStorage.setItem('setupComplete', 'true');
      setCalendarModePreference(formData.defaultCalendar as 'BS' | 'AD');
      navigate('/dashboard');
    } catch (e) {
      alert("Failed to finalize setup: " + e);
    }
  };

  const steps = [
    { icon: Shield, title: 'Activation' },
    { icon: CheckCircle2, title: 'Verified' },
    { icon: Building2, title: 'Branch' },
    { icon: Globe, title: 'Localization' },
    { icon: Cloud, title: 'Cloud Sync' },
  ];

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-primary/90 to-primary flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl shadow-2xl border-0">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{AppConfig.appName}</CardTitle>
              <CardDescription>Initial Setup Wizard</CardDescription>
            </div>
            <Badge variant="outline" className="text-sm">
              Step {step} of 5
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent transition-all duration-300 ease-in-out"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>

          {/* Step indicators */}
          <div className="flex items-center justify-between gap-2 pt-2">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              const isActive = idx + 1 === step;
              const isCompleted = idx + 1 < step;
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon size={18} />
                </div>
              );
            })}
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="pt-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Software Activation</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your cloud credentials and enter your license key to activate.
                </p>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg border border-dashed">
                <span className="text-xs uppercase text-muted-foreground">Computer ID</span>
                <code className="block text-xs mt-1 break-all font-mono">{formData.hardwareId}</code>
              </div>

              <div className="space-y-2">
                <Label>1. Cloud Credentials (.json)</Label>
                <div className="flex items-center gap-3">
                  <Button onClick={() => fileInputRef.current?.click()}>
                    <Upload size={16} />
                    Choose JSON Key
                  </Button>
                  <input type="file" accept=".json" ref={fileInputRef} hidden onChange={handleFileUpload} />
                  <Badge variant={formData.jsonKeyText ? 'success' : 'destructive'}>
                    {formData.jsonKeyText ? '✅ Loaded' : '❌ Not Loaded'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="authKey">2. License Key</Label>
                <Input
                  id="authKey"
                  placeholder="BIO-XXXX-XXXX-XXXX"
                  value={formData.authKey}
                  onChange={e => setFormData({ ...formData, authKey: e.target.value})}
                />
              </div>

              <Button className="w-full" onClick={handleVerify}>
                <CheckCircle2 size={16} />
                Activate License
              </Button>

              <button
                onClick={handleAdminGenerate}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
              >
                [Admin] Generate 5 Stock Keys on Drive
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Verification Successful</h3>
                <p className="text-sm text-muted-foreground">
                  Your license from Google Drive has been validated.
                </p>
              </div>

              <div className="p-6 bg-green-500/10 border border-green-500 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={20} className="text-green-600" />
                  <span className="font-semibold text-green-700">License Activated</span>
                </div>
                <p className="text-sm">
                  Expiry Date: <strong className="text-green-600">{formData.licenseExpiry}</strong>
                </p>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={prevStep}>
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <Button onClick={nextStep}>
                  Next
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Multi-Branch Setup</h3>
                <p className="text-sm text-muted-foreground">
                  Define your primary branch. Sub-branches can be added later via Settings.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Primary Branch</Label>
                <Input value="Head Office" disabled className="bg-muted/50" />
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={prevStep}>
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <Button onClick={nextStep}>
                  Next
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Localization</h3>
                <p className="text-sm text-muted-foreground">
                  Configure your regional settings and calendar system.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="calendar">Default Calendar System</Label>
                  <Select
                    id="calendar"
                    value={formData.defaultCalendar}
                    onChange={e => setFormData({...formData, defaultCalendar: e.target.value})}
                  >
                    <option value="BS">Bikram Sambat (BS)</option>
                    <option value="AD">English Date (AD)</option>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weekend">Global Weekend</Label>
                  <Select
                    id="weekend"
                    value={formData.globalWeekend}
                    onChange={e => setFormData({...formData, globalWeekend: e.target.value})}
                  >
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={prevStep}>
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <Button onClick={nextStep}>
                  Next
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Cloud Sync Setup</h3>
                <p className="text-sm text-muted-foreground">
                  Configure Google Drive to automatically push employee attendance logs.
                </p>
              </div>

              {formData.serviceAccountEmail && (
                <div className="p-4 bg-green-500/10 border border-green-500 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <UploadCloud size={20} className="text-green-600" />
                    <span className="font-semibold text-green-700">Drive Sync Status</span>
                  </div>
                  <p className="text-sm">
                    ✅ Credentials verified during activation.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    {formData.serviceAccountEmail}
                  </p>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={prevStep}>
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <Button onClick={handleFinish}>
                  <CheckCircle2 size={16} />
                  Complete Setup
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        <Separator />

        <CardFooter className="flex justify-between py-4">
          <div className="text-xs text-muted-foreground">
            {step === 5 ? 'Final step' : `${5 - step} steps remaining`}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                localStorage.setItem('setupComplete', 'true');
                window.location.reload();
              }}
              className="text-xs text-muted-foreground hover:text-primary underline"
            >
              Skip Setup & Go to Login
            </button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText size={14} />
              <span>BioBridge Pro HR Setup</span>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
