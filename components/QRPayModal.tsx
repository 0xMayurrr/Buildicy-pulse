import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
  Platform,
  Animated,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { parseUpiQr, launchUpiApp, ParsedUpi } from '../lib/upi';
import { supabase, subscribeToRealtimeChanges } from '../lib/supabase';
import { formatCurrency, formatFullCurrency, COLORS } from '../data/demo';
import { PaymentAppBadge } from './PaymentAppBadges';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'scan' | 'confirm' | 'select_app' | 'save_category';

export function QRPayModal({ visible, onClose, onSuccess }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>('scan');
  const [torch, setTorch] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [scannedData, setScannedData] = useState<ParsedUpi | null>(null);

  // Form State
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [selectedApp, setSelectedApp] = useState<'gpay' | 'phonepe' | 'paytm' | 'generic'>('gpay');

  // Categorization Form
  const [categoryType, setCategoryType] = useState<
    'Business Expense' | 'Member Payout' | 'Project Expense' | 'Other'
  >('Business Expense');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'completed'>('pending');

  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [membersList, setMembersList] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Animated Laser Beam Value
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && step === 'scan') {
      const laserAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      );
      laserAnimation.start();
      return () => laserAnimation.stop();
    }
  }, [visible, step]);

  useEffect(() => {
    if (visible) {
      resetModalState();
      fetchDropdownOptions();
      const unsubscribe = subscribeToRealtimeChanges(() => {
        console.log('[REALTIME UPDATE] QR Modal dropdown data update...');
        fetchDropdownOptions();
      });
      return () => unsubscribe();
    }
  }, [visible]);

  function resetModalState() {
    setStep('scan');
    setTorch(false);
    setManualInput('');
    setScannedData(null);
    setAmount('');
    setNote('');
    setSelectedApp('gpay');
    setCategoryType('Business Expense');
    setSelectedProject(null);
    setSelectedMember(null);
    setPaymentStatus('pending');
    setSaving(false);
  }

  async function fetchDropdownOptions() {
    try {
      const { data: p } = await supabase.from('projects').select('name');
      const { data: m } = await supabase.from('members').select('name');
      setProjectsList(p || []);
      setMembersList(m || []);
    } catch (e) {
      console.log('[QR MODAL FETCH ERROR]', e);
    }
  }

  // Handle scanned barcode / QR data
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (step !== 'scan' || !data) return;
    try {
      Vibration.vibrate(100);
    } catch (err) {
      // Ignore vibration error on unsupported platforms
    }
    console.log('[QR SCANNER SUCCESS] Scanned raw QR data:', data);
    processParsedQr(data);
  };

  const handleManualSubmit = () => {
    if (!manualInput.trim()) {
      Alert.alert('Error', 'Please enter a valid UPI ID or paste QR link');
      return;
    }
    console.log('[QR MANUAL INPUT] Processing input:', manualInput);
    processParsedQr(manualInput.trim());
  };

  function processParsedQr(rawStr: string) {
    const parsed = parseUpiQr(rawStr);
    console.log('[UPI PARSER RESULT]', parsed);
    setScannedData(parsed);
    if (parsed.am) {
      setAmount(parsed.am);
    }
    if (parsed.tn) {
      setNote(parsed.tn);
    }
    setStep('confirm');
  }

  const handleProceedToAppSelect = () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount (e.g. ₹500)');
      return;
    }
    setStep('select_app');
  };

  const handleLaunchPaymentApp = async (app: 'gpay' | 'phonepe' | 'paytm' | 'generic') => {
    if (!scannedData) return;
    setSelectedApp(app);

    const success = await launchUpiApp(app, {
      pa: scannedData.pa,
      pn: scannedData.pn,
      am: amount,
      tn: note || 'Buildicy Pulse Payment',
    });

    if (success) {
      console.log('[UPI DEEP LINK SUCCESS] App launched. Transitioning to Post-Payment Categorization...');
      setStep('save_category');
    } else {
      Alert.alert(
        'App Launch Failed',
        'Could not open the selected payment application. Proceeding to save payment record.',
        [{ text: 'Continue', onPress: () => setStep('save_category') }]
      );
    }
  };

  async function handleSaveTransaction() {
    if (!scannedData || !amount) return;
    setSaving(true);

    let mappedCategory = 'Operations';
    if (categoryType === 'Member Payout') mappedCategory = 'Member Payout';
    if (categoryType === 'Project Expense') mappedCategory = 'Software';
    if (categoryType === 'Other') mappedCategory = 'Other';

    const appLabel =
      selectedApp === 'gpay'
        ? 'Google Pay'
        : selectedApp === 'phonepe'
        ? 'PhonePe'
        : selectedApp === 'paytm'
        ? 'Paytm'
        : 'UPI App';

    const payload = {
      type: 'expense',
      description: scannedData.pn || 'UPI Payment',
      amount: parseFloat(amount),
      category: mappedCategory,
      date: new Date().toISOString().split('T')[0],
      project: selectedProject || null,
      member: selectedMember || null,
      payment_status: paymentStatus, // 'pending' (PAYMENT INITIATED / PENDING CONFIRMATION)
      notes: `UPI ID: ${scannedData.pa} | App: ${appLabel}${note ? ` | Note: ${note}` : ''}`,
    };

    try {
      console.log('[SUPABASE QR PAYMENT SAVE] Saving QR expense transaction record...', payload);
      const { error } = await supabase.from('transactions').insert(payload);
      if (error) throw error;

      console.log('[SUPABASE QR PAYMENT SAVE SUCCESS] Transaction saved successfully!');
      Alert.alert(
        'Payment Record Saved!',
        `Recorded ₹${amount} payment to ${scannedData.pn} as [${paymentStatus.toUpperCase()}].`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[SUPABASE QR PAYMENT SAVE ERROR]', err.message || err);
      Alert.alert('Save Error', err.message || 'Failed to record transaction');
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.modalHeader}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconBadge}>
              <Ionicons name="qr-code" size={18} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.headerBrand}>BUILDICY PULSE</Text>
              <Text style={styles.headerTitle}>
                {step === 'scan'
                  ? 'SCAN MERCHANT QR CODE'
                  : step === 'confirm'
                  ? 'CONFIRM PAYMENT DETAILS'
                  : step === 'select_app'
                  ? 'SELECT UPI PAYMENT APP'
                  : 'WHAT WAS THIS PAYMENT FOR?'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color="#0B0F17" />
          </TouchableOpacity>
        </View>

        {/* STEP 1: ENHANCED CYBER CAMERA SCANNER VIEW */}
        {step === 'scan' && (
          <View style={styles.stepContainer}>
            {permission?.granted ? (
              <View style={styles.cameraBox}>
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  enableTorch={torch}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={handleBarcodeScanned}
                />
                {/* Viewfinder Frame with Animated Laser Scan */}
                <View style={styles.viewfinderOverlay}>
                  {/* Cyber Scanner Header HUD */}
                  <View style={styles.hudHeaderBadge}>
                    <View style={styles.hudLiveDot} />
                    <Text style={styles.hudHeaderText}>CYBER SCANNER ACTIVE • TARGET UPI QR</Text>
                  </View>

                  <View style={styles.scanFrame}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />

                    {/* Center Crosshair HUD */}
                    <View style={styles.crosshairCenter}>
                      <Ionicons name="add-outline" size={24} color="rgba(192, 132, 252, 0.6)" />
                    </View>

                    {/* Animated Neon Sweep Laser */}
                    <Animated.View
                      style={[
                        styles.scanLaser,
                        {
                          transform: [
                            {
                              translateY: scanAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [4, 210],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.cameraActionsRow}>
                    <Text style={styles.cameraTip}>CENTER MERCHANTS UPI QR CODE</Text>
                    <TouchableOpacity
                      style={[styles.torchBtn, torch && styles.activeTorchBtn]}
                      onPress={() => setTorch(!torch)}
                    >
                      <Ionicons name={torch ? 'flash' : 'flash-outline'} size={18} color={torch ? '#0B0F17' : '#FFFFFF'} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.permissionCard}>
                <Ionicons name="camera" size={48} color="#7C3AED" />
                <Text style={styles.permTitle}>CAMERA PERMISSION REQUIRED</Text>
                <Text style={styles.permSub}>
                  Buildicy Pulse requires camera access to scan merchant QR codes instantly.
                </Text>
                <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
                  <Text style={styles.permBtnText}>GRANT CAMERA ACCESS</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Manual Input Fallback Card (Crisp White + High Contrast) */}
            <View style={styles.manualCard}>
              <Text style={styles.manualCardTitle}>OR ENTER UPI ID / PASTE QR CODE</Text>
              <View style={styles.manualRow}>
                <TextInput
                  style={styles.manualInput}
                  placeholder="merchant@okicici or upi://pay?pa=..."
                  placeholderTextColor="#94A3B8"
                  value={manualInput}
                  onChangeText={setManualInput}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.manualBtn} onPress={handleManualSubmit}>
                  <Text style={styles.manualBtnText}>PROCEED</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* STEP 2: CONFIRM PAYMENT DETAILS (Clean Crisp White & Obsidian) */}
        {step === 'confirm' && scannedData && (
          <ScrollView contentContainerStyle={styles.stepScroll}>
            <View style={styles.whiteCard}>
              <View style={styles.merchantHeader}>
                <View style={styles.merchantAvatar}>
                  <Ionicons name="storefront" size={26} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payToLabel}>PAYING TO MERCHANT</Text>
                  <Text style={styles.merchantName}>{scannedData.pn}</Text>
                  <Text style={styles.upiIdText}>{scannedData.pa}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>ENTER AMOUNT (₹)</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="₹ 0.00"
                  placeholderTextColor="#94A3B8"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>TRANSACTION NOTE / REFERENCE (OPTIONAL)</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="e.g. Office laptop / Client lunch"
                  placeholderTextColor="#94A3B8"
                  value={note}
                  onChangeText={setNote}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.primaryActionBtn} onPress={handleProceedToAppSelect}>
              <Text style={styles.primaryActionBtnText}>SELECT PAYMENT APP →</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('scan')}>
              <Text style={styles.secondaryBtnText}>← RE-SCAN QR CODE</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* STEP 3: SELECT PAYMENT APP WITH REAL BADGES */}
        {step === 'select_app' && scannedData && (
          <ScrollView contentContainerStyle={styles.stepScroll}>
            {/* Payee Banner */}
            <View style={styles.whiteCard}>
              <Text style={styles.payToLabel}>PAYING TO</Text>
              <Text style={styles.merchantName}>{scannedData.pn}</Text>
              <Text style={styles.bannerAmount}>{formatFullCurrency(parseFloat(amount || '0'))}</Text>
            </View>

            <Text style={styles.sectionHeading}>CHOOSE PAYMENT APP ON YOUR DEVICE</Text>

            {/* Payment App Cards */}
            <View style={styles.appsList}>
              <TouchableOpacity
                style={[styles.appRowCard, { borderLeftColor: '#4285F4' }]}
                onPress={() => handleLaunchPaymentApp('gpay')}
                activeOpacity={0.8}
              >
                <PaymentAppBadge app="gpay" size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.appName}>Google Pay</Text>
                  <Text style={styles.appSub}>Instant GPay UPI Deep-link</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#7C3AED" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.appRowCard, { borderLeftColor: '#5F259F' }]}
                onPress={() => handleLaunchPaymentApp('phonepe')}
                activeOpacity={0.8}
              >
                <PaymentAppBadge app="phonepe" size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.appName}>PhonePe</Text>
                  <Text style={styles.appSub}>Instant PhonePe UPI Intent</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#7C3AED" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.appRowCard, { borderLeftColor: '#00BAF2' }]}
                onPress={() => handleLaunchPaymentApp('paytm')}
                activeOpacity={0.8}
              >
                <PaymentAppBadge app="paytm" size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.appName}>Paytm</Text>
                  <Text style={styles.appSub}>Instant Paytm Wallet & UPI</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#7C3AED" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.appRowCard, { borderLeftColor: '#7C3AED' }]}
                onPress={() => handleLaunchPaymentApp('generic')}
                activeOpacity={0.8}
              >
                <PaymentAppBadge app="bhim" size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.appName}>BHIM / Other UPI App</Text>
                  <Text style={styles.appSub}>System UPI Application Chooser</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#7C3AED" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('confirm')}>
              <Text style={styles.secondaryBtnText}>← EDIT DETAILS</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* STEP 4: CATEGORIZATION & SAVE (HIGH CONTRAST WHITE + OBSIDIAN) */}
        {step === 'save_category' && scannedData && (
          <ScrollView contentContainerStyle={styles.stepScroll}>
            {/* Question Card */}
            <View style={styles.whiteCard}>
              <View style={styles.questionHeader}>
                <View style={styles.questionIconBadge}>
                  <Ionicons name="help-circle" size={28} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.questionTitle}>WHAT WAS THIS PAYMENT FOR?</Text>
                  <Text style={styles.questionSubtitle}>
                    Recording ₹{amount} payment to {scannedData.pn}
                  </Text>
                </View>
              </View>
            </View>

            {/* Category Cards */}
            <View style={styles.optionsList}>
              {[
                { type: 'Business Expense', label: 'Business Expense', icon: 'briefcase', sub: 'Operations & Supplies' },
                { type: 'Member Payout', label: 'Member Payout', icon: 'people', sub: 'Team & Contractor Payouts' },
                { type: 'Project Expense', label: 'Project Expense', icon: 'code-slash', sub: 'Software, Hosting & Dev' },
                { type: 'Other', label: 'Other Expense', icon: 'grid', sub: 'Miscellaneous' },
              ].map(opt => {
                const isSelected = categoryType === opt.type;
                return (
                  <TouchableOpacity
                    key={opt.type}
                    style={[styles.categoryOptionCard, isSelected && styles.activeCategoryCard]}
                    onPress={() => setCategoryType(opt.type as any)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.optIconBox, isSelected && styles.activeOptIconBox]}>
                      <Ionicons
                        name={opt.icon as any}
                        size={20}
                        color={isSelected ? '#FFFFFF' : '#7C3AED'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optTitle, isSelected && styles.activeOptTitle]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.optSub, isSelected && styles.activeOptSub]}>
                        {opt.sub}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Link to Project */}
            {projectsList.length > 0 && (
              <View style={styles.whiteCard}>
                <Text style={styles.fieldLabel}>LINK TO PROJECT (OPTIONAL)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    <TouchableOpacity
                      style={[styles.chip, !selectedProject && styles.activeChip]}
                      onPress={() => setSelectedProject(null)}
                    >
                      <Text style={[styles.chipText, !selectedProject && styles.activeChipText]}>NONE</Text>
                    </TouchableOpacity>
                    {projectsList.map(p => (
                      <TouchableOpacity
                        key={p.name}
                        style={[styles.chip, selectedProject === p.name && styles.activeChip]}
                        onPress={() => setSelectedProject(p.name)}
                      >
                        <Text style={[styles.chipText, selectedProject === p.name && styles.activeChipText]}>
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Status Notice Rule */}
            <View style={styles.statusNoticeBox}>
              <Ionicons name="information-circle" size={20} color="#D97706" />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusNoticeTitle}>PAYMENT STATUS</Text>
                <Text style={styles.statusNoticeText}>
                  Recorded as <Text style={{ fontWeight: '900', color: '#0B0F17' }}>[PAYMENT INITIATED / PENDING CONFIRMATION]</Text> until verified.
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={handleSaveTransaction}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryActionBtnText}>SAVE TRANSACTION TO SUPABASE →</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelBtnText}>DON'T RECORD THIS PAYMENT</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F7FC', // Crisp Off-White Background
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 20,
    paddingBottom: 16,
    backgroundColor: '#0B0F17', // Deep Obsidian Black Header
    borderBottomWidth: 2,
    borderBottomColor: '#7C3AED',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrand: {
    fontSize: 9,
    fontWeight: '900',
    color: '#A855F7',
    letterSpacing: 2,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepContainer: {
    flex: 1,
    padding: 16,
    gap: 14,
  },
  stepScroll: {
    padding: 16,
    gap: 14,
  },

  // Enhanced Camera Viewfinder
  cameraBox: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#7C3AED',
    minHeight: 320,
  },
  viewfinderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 15, 23, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(11, 15, 23, 0.85)',
    borderWidth: 1.5,
    borderColor: '#06B6D4',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  hudLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#06B6D4',
  },
  hudHeaderText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 1.5,
  },

  scanFrame: {
    width: 230,
    height: 230,
    position: 'relative',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    backgroundColor: 'rgba(124, 58, 237, 0.05)',
  },
  crosshairCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -12,
    marginLeft: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#A855F7',
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#06B6D4' },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#A855F7' },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#A855F7' },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#06B6D4' },
  scanLaser: {
    width: '100%',
    height: 4,
    backgroundColor: '#38BDF8',
    borderRadius: 2,
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
  },
  cameraActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  cameraTip: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    backgroundColor: '#0B0F17',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    borderRadius: 8,
  },
  torchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#7C3AED',
  },
  activeTorchBtn: {
    backgroundColor: '#F59E0B',
    borderColor: '#0B0F17',
  },

  permissionCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#7C3AED',
  },
  permTitle: { fontSize: 14, fontWeight: '900', color: '#0B0F17', letterSpacing: 1 },
  permSub: { fontSize: 11, color: '#64748B', textAlign: 'center', lineHeight: 16 },
  permBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  permBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  // Manual Card (Crisp White + High Contrast)
  manualCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#0B0F17',
    gap: 8,
  },
  manualCardTitle: { fontSize: 9, fontWeight: '900', color: '#7C3AED', letterSpacing: 1.5 },
  manualRow: { flexDirection: 'row', gap: 8 },
  manualInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F8F7FC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#0B0F17',
    fontSize: 12,
    fontWeight: '700',
  },
  manualBtn: {
    backgroundColor: '#0B0F17',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  manualBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  // White Card Component
  whiteCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0B0F17',
    borderRadius: 16,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  merchantHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  merchantAvatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#7C3AED',
  },
  payToLabel: { fontSize: 9, fontWeight: '900', color: '#7C3AED', letterSpacing: 1.5 },
  merchantName: { fontSize: 18, fontWeight: '900', color: '#0B0F17' },
  upiIdText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  bannerAmount: { fontSize: 32, fontWeight: '900', color: '#059669', marginTop: 4 },

  divider: { height: 1.5, backgroundColor: '#F1F5F9' },
  formField: { gap: 6 },
  fieldLabel: { fontSize: 9, fontWeight: '900', color: '#7C3AED', letterSpacing: 1.5 },
  amountInput: {
    height: 52,
    backgroundColor: '#F8F7FC',
    borderWidth: 2,
    borderColor: '#7C3AED',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: '900',
    color: '#059669',
  },
  noteInput: {
    height: 46,
    backgroundColor: '#F8F7FC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 13,
    color: '#0B0F17',
    fontWeight: '600',
  },

  sectionHeading: { fontSize: 10, fontWeight: '900', color: '#0B0F17', letterSpacing: 2, marginTop: 4 },

  // App Selector Cards (Crisp White + Side Accent)
  appsList: { gap: 10 },
  appRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0B0F17',
    borderLeftWidth: 6,
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  appName: { fontSize: 15, fontWeight: '900', color: '#0B0F17' },
  appSub: { fontSize: 10, fontWeight: '700', color: '#64748B' },

  // Categorization Options (Crisp White vs Royal Purple Active)
  questionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  questionIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#7C3AED',
  },
  questionTitle: { fontSize: 14, fontWeight: '900', color: '#0B0F17', letterSpacing: 0.5 },
  questionSubtitle: { fontSize: 11, color: '#64748B', fontWeight: '600' },

  optionsList: { gap: 8 },
  categoryOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0B0F17',
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  activeCategoryCard: {
    backgroundColor: '#7C3AED',
    borderColor: '#0B0F17',
  },
  optIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeOptIconBox: {
    backgroundColor: '#6D28D9',
  },
  optTitle: { fontSize: 13, fontWeight: '900', color: '#0B0F17' },
  activeOptTitle: { color: '#FFFFFF' },
  optSub: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  activeOptSub: { color: '#E9D5FF' },

  chipRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8F7FC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
  },
  activeChip: { backgroundColor: '#7C3AED', borderColor: '#0B0F17' },
  chipText: { fontSize: 10, fontWeight: '800', color: '#64748B' },
  activeChipText: { color: '#FFFFFF' },

  statusNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    padding: 12,
    borderRadius: 10,
  },
  statusNoticeTitle: { fontSize: 8, fontWeight: '900', color: '#D97706', letterSpacing: 1.5 },
  statusNoticeText: { fontSize: 10, color: '#92400E', fontWeight: '700', lineHeight: 14 },

  primaryActionBtn: {
    height: 52,
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0B0F17',
    marginTop: 4,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryActionBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  secondaryBtn: {
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0B0F17',
  },
  secondaryBtnText: { color: '#0B0F17', fontSize: 11, fontWeight: '900' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { color: '#DC2626', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
});
