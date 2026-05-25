/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-native/no-unused-styles */

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';

const EDIT_PASSWORD = '2587';

export default function ShiftChecklistScreen() {
  const isInitialized = React.useRef(false);

  const today = new Date();

  const formattedDate = `${today
    .getDate()
    .toString()
    .padStart(2, '0')}.${(today.getMonth() + 1)
    .toString()
    .padStart(2, '0')}.${today.getFullYear()}`;

  const morningHours = ['08', '09', '10', '11', '12', '13', '14'];
  const lunchHours = ['15', '16', '17', '18', '19', '20'];

  const [shiftType, setShiftType] = useState<'morning' | 'lunch'>('morning');
  const [name, setName] = useState('');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [duringChecks, setDuringChecks] = useState<Record<string, boolean>>({});
  const [afterChecks, setAfterChecks] = useState<Record<string, boolean>>({});
  const [walkChecks, setWalkChecks] = useState<Record<string, boolean>>({});
  const [hoursWorked, setHoursWorked] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [password, setPassword] = useState('');
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [notes, setNotes] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  const [morningChecklist, setMorningChecklist] = useState([
    'Prebraté shift kľúče a mngr trezor?',
    'Ľudia na zmenu naplánovaní?',
    'Ciele zmeny nadefinované?',
    'BTO tabuľky vyplnené?',
    'Kontrola deaktivovaných produktov?',
    'FIFO a FSA',
    'Funkčné zariadenia',
    'Uniformy zamestnancov',
  ]);

  const [lunchChecklist, setLunchChecklist] = useState([
    'Ľudia na zmenu naplánovaní?',
    'Skontrolované doby spotreby?',
    'Ciele zmeny nadefinované?',
    'BTO tabuľky vyplnené?',
    'Kontrola deaktivovaných produktov?',
    'Lobby je čisté?',
    'e-production nastavená?',
    'FIFO a FSA',
    'Funkčné zariadenia',
    'Uniformy zamestnancov',
  ]);

  type TableRow = {
    hour: string; salesPlan: string; salesReality: string;
    tcPlan: string; tcReality: string; mfy: string;
    r2p: string; sendKuch: string; del: string;
  };
  const mkRows = (hours: string[]): TableRow[] =>
    hours.map((h) => ({ hour: h, salesPlan: '', salesReality: '', tcPlan: '', tcReality: '', mfy: '', r2p: '', sendKuch: '', del: '' }));

  const [morningTableData, setMorningTableData] = useState<TableRow[]>(() => mkRows(morningHours));
  const [lunchTableData, setLunchTableData] = useState<TableRow[]>(() => mkRows(lunchHours));
  const [morningWalkTimes, setMorningWalkTimes] = useState<string[]>(() => morningHours.map((h) => `${h}:00`));
  const [lunchWalkTimes, setLunchWalkTimes] = useState<string[]>(() => lunchHours.map((h) => `${h}:00`));

  const [duringChecklist, setDuringChecklist] = useState(
    shiftType === 'morning'
      ? [
          'Kontrola raňajok (Prechod)',
          'Kuchyňa aj servis navozené?',
          'HACCP kontroly vykonané?',
        ]
      : [
          'Hodinové vyhodnocovanie ukazovateľov',
          'Kuchyňa aj servis navozené?',
          'HACCP kontroly vykonané?',
        ]
  );

  const [afterChecklist, setAfterChecklist] = useState(
    shiftType === 'morning'
      ? [
          'Ciele vyhodnotené a komunikované s vedúcimi zón?',
          'Vyvozené príručné mrazničky',
          'Tabuľka vyhodnotenie zmeny vyplnená?',
          'Vyčistený kávovar',
          'Tréning + verifikácie v tabuľke vyhodnotené?',
          'Kancelária je čistá, poriadená?',
        ]
      : [
          'Podstatné informácie prichádzajúcemu shiftovi odovzdané?',
          'Ciele vyhodnotené a komunikované s vedúcimi zón?',
          'Odpad nahodený?',
          'Tabuľka vyhodnotenie zmeny vyplnená?',
          'Depozity a odvod spravený?',
          'Tréning + verifikácie v tabuľke vyhodnotené?',
          'Kancelária je čistá, poriadená?',
        ]
  );

  const [walkChecklist] = useState([
    'Kontrola lobby',
    'Kontrola WC',
    'Kontrola kitchen',
  ]);

  const currentHoursForShift = shiftType === 'morning' ? morningHours : lunchHours;
  const tableData = shiftType === 'morning' ? morningTableData : lunchTableData;
  const walkTimes = shiftType === 'morning' ? morningWalkTimes : lunchWalkTimes;
  const setTableData = (data: TableRow[]) => {
    if (shiftType === 'morning') setMorningTableData(data);
    else setLunchTableData(data);
  };
  const setWalkTimes = (times: string[]) => {
    if (shiftType === 'morning') setMorningWalkTimes(times);
    else setLunchWalkTimes(times);
  };

  useEffect(() => {
    loadData();
    if (Platform.OS !== 'web') {
      Notifications.requestPermissionsAsync();
    }
  }, []);

  useEffect(() => {
    if (!isInitialized.current) return;
    saveData();
  }, [
    name,
    checks,
    duringChecks,
    afterChecks,
    walkChecks,
    hoursWorked,
    morningChecklist,
    lunchChecklist,
    morningTableData,
    lunchTableData,
    morningWalkTimes,
    lunchWalkTimes,
    darkMode,
    notes,
  ]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const interval = setInterval(() => {
      checkNotifications();
    }, 60000);
    return () => clearInterval(interval);
  }, [tableData, checks, shiftType]);

  const loadData = async () => {
    try {
      const savedData = await AsyncStorage.getItem('shiftAppData');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setName(parsed.name || '');
        setChecks(parsed.checks || {});
        setDuringChecks(parsed.duringChecks || {});
        setAfterChecks(parsed.afterChecks || {});
        setWalkChecks(parsed.walkChecks || {});
        setHoursWorked(parsed.hoursWorked || '');
        setNotes(parsed.notes || '');
        setDarkMode(parsed.darkMode || false);

        if (parsed.morningTableData?.length > 0) {
          setMorningTableData(parsed.morningTableData);
        }
        if (parsed.morningWalkTimes?.length > 0) {
          setMorningWalkTimes(parsed.morningWalkTimes);
        }
        if (parsed.lunchTableData?.length > 0) {
          setLunchTableData(parsed.lunchTableData);
        }
        if (parsed.lunchWalkTimes?.length > 0) {
          setLunchWalkTimes(parsed.lunchWalkTimes);
        }
      }

      const savedMorning = await AsyncStorage.getItem('morningChecklist');
      const savedLunch = await AsyncStorage.getItem('lunchChecklist');
      if (savedMorning) setMorningChecklist(JSON.parse(savedMorning));
      if (savedLunch) setLunchChecklist(JSON.parse(savedLunch));
    } catch (e) {
      console.log(e);
    }
    isInitialized.current = true;
  };

  const saveData = async () => {
    try {
      const data = {
        name, checks, duringChecks, afterChecks, walkChecks,
        hoursWorked, notes, darkMode,
        morningTableData, morningWalkTimes,
        lunchTableData, lunchWalkTimes,
      };
      await AsyncStorage.setItem('shiftAppData', JSON.stringify(data));
      await AsyncStorage.setItem('morningChecklist', JSON.stringify(morningChecklist));
      await AsyncStorage.setItem('lunchChecklist', JSON.stringify(lunchChecklist));
    } catch (e) {
      console.log(e);
    }
  };

  const switchShift = (newShift: 'morning' | 'lunch') => {
    setShiftType(newShift);
  };

  const checkNotifications = async () => {
    if (Platform.OS === 'web') return;
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();

    if (shiftType === 'morning' && currentHour === 8 && currentMinutes === 30) {
      const allChecked = Object.values(checks).every((v) => v === true);
      if (!allChecked) {
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Ranný checklist', body: 'Nemáš dokončený checklist pred zmenou' },
          trigger: null,
        });
      }
    }

    if (shiftType === 'lunch' && currentHour === 15 && currentMinutes === 0) {
      const allChecked = Object.values(checks).every((v) => v === true);
      if (!allChecked) {
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Obedný checklist', body: 'Nemáš dokončený checklist pred zmenou' },
          trigger: null,
        });
      }
    }

    if (currentMinutes >= 15) {
      const previousHour = (currentHour - 1).toString().padStart(2, '0');
      const row = tableData.find((r) => r.hour === previousHour);
      if (row && (row.salesReality === '' || row.tcReality === '')) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Nevyplnená hodina',
            body: `Zabudol si vypísať hodinu ${previousHour}:00`,
          },
          trigger: null,
        });
      }
    }
  };

  const toggleCheck = (key: string) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleDuringCheck = (key: string) => {
    setDuringChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAfterCheck = (key: string) => {
    setAfterChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleWalkCheck = (key: string) => {
    setWalkChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateChecklist = (section: string, index: number, value: string) => {
    if (section === 'before') {
      const updated = [...(shiftType === 'morning' ? morningChecklist : lunchChecklist)];
      updated[index] = value;
      if (shiftType === 'morning') setMorningChecklist(updated);
      else setLunchChecklist(updated);
    }
    if (section === 'during') {
      const updated = [...duringChecklist];
      updated[index] = value;
      setDuringChecklist(updated);
    }
    if (section === 'after') {
      const updated = [...afterChecklist];
      updated[index] = value;
      setAfterChecklist(updated);
    }
  };

  const addChecklistItem = (section: string) => {
    if (section === 'before') {
      if (shiftType === 'morning') setMorningChecklist([...morningChecklist, '']);
      else setLunchChecklist([...lunchChecklist, '']);
    }
    if (section === 'during') {
      setDuringChecklist([...duringChecklist, '']);
    }
    if (section === 'after') {
      setAfterChecklist([...afterChecklist, '']);
    }
  };

  const deleteChecklistItem = (section: string, index: number) => {
    if (section === 'before') {
      if (shiftType === 'morning') {
        setMorningChecklist(morningChecklist.filter((_, i) => i !== index));
      } else {
        setLunchChecklist(lunchChecklist.filter((_, i) => i !== index));
      }
    }
    if (section === 'during') {
      setDuringChecklist(duringChecklist.filter((_, i) => i !== index));
    }
    if (section === 'after') {
      setAfterChecklist(afterChecklist.filter((_, i) => i !== index));
    }
  };

  const updateWalkTime = (index: number, value: string) => {
    const updated = [...walkTimes];
    updated[index] = value;
    setWalkTimes(updated);
  };

  const addTableRow = () => {
    const newRow = {
      hour: '',
      salesPlan: '',
      salesReality: '',
      tcPlan: '',
      tcReality: '',
      mfy: '',
      r2p: '',
      sendKuch: '',
      del: '',
    };
    setTableData([...tableData, newRow]);
    setWalkTimes([...walkTimes, '']);
  };

  const deleteTableRow = (index: number) => {
    setTableData(tableData.filter((_, i) => i !== index));
    setWalkTimes(walkTimes.filter((_, i) => i !== index));
  };

  const resetShift = () => {
    Alert.alert(
      'Reset zmeny',
      'Naozaj chceš resetovať zmenu?',
      [
        { text: 'Nie', style: 'cancel' },
        {
          text: 'Áno',
          style: 'destructive',
          onPress: async () => {
            const newTableData = currentHoursForShift.map((hour) => ({
              hour,
              salesPlan: '',
              salesReality: '',
              tcPlan: '',
              tcReality: '',
              mfy: '',
              r2p: '',
              sendKuch: '',
              del: '',
            }));
            setChecks({});
            setDuringChecks({});
            setAfterChecks({});
            setWalkChecks({});
            setNotes('');
            setHoursWorked('');
            setTableData(newTableData);
            setWalkTimes(newTableData.map((row) => `${row.hour}:00`));
          },
        },
      ],
      { cancelable: true }
    );
  };

  const updateRow = (index: number, field: string, value: string) => {
    const updated = [...tableData];
    updated[index] = { ...updated[index], [field]: value };
    const tcPlan = parseFloat(updated[index].tcPlan) || 0;
    updated[index].sendKuch = (tcPlan * 1.9).toFixed(0);
    updated[index].del = (tcPlan * 0.07).toFixed(0);
    setTableData(updated);
  };

  const calculateSum = (field: string) => {
    return tableData.reduce((sum, row) => {
      const val = (row as any)[field];
      return sum + (parseFloat(val) || 0);
    }, 0);
  };

  const calculateAverage = () => {
    const values = tableData.map((row) => parseFloat(row.r2p)).filter((v) => !isNaN(v));
    if (values.length === 0) return '0';
    return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2);
  };

  const calculateProductivity = (field: string) => {
    const hours = parseFloat(hoursWorked) || 0;
    if (hours === 0) return '0';
    return (calculateSum(field) / hours).toFixed(2);
  };

  const getPerformanceColor = (plan: string, real: string) => {
    const planValue = parseFloat(plan) || 0;
    const realValue = parseFloat(real) || 0;
    if (planValue === 0 || realValue === 0)
      return darkMode ? '#1e1b00' : 'white';
    if (realValue >= planValue) return darkMode ? '#0d4a28' : '#7DFFB3';
    if (realValue >= planValue * 0.9) return darkMode ? '#5a3a00' : '#FFC857';
    return darkMode ? '#5a1212' : '#FF6B6B';
  };

  const unlockEditing = () => {
    if (password === EDIT_PASSWORD) {
      setEditingEnabled(true);
      setPassword('');
      Alert.alert('Odomknuté', 'Editovanie povolené');
    } else {
      Alert.alert('Chyba', 'Nesprávne heslo');
    }
  };

  const checklist = shiftType === 'morning' ? morningChecklist : lunchChecklist;

  const theme = darkMode ? darkTheme : lightTheme;

  const colWidths = [34, 58, 58, 58, 58, 42, 42, 42, 42];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.text }]}>Shift check-list</Text>
          <TouchableOpacity
            style={[styles.topRightSettings, { backgroundColor: theme.card }]}
            onPress={() => setShowSettings(!showSettings)}
          >
            <Ionicons name="settings-outline" size={26} color={theme.icon} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.date, { color: theme.subText }]}>Dátum: {formattedDate}</Text>

        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, color: theme.inputText }]}
          placeholder="Meno"
          placeholderTextColor={theme.inputPlaceholder}
          value={name}
          onChangeText={setName}
        />

        {showSettings && (
          <View style={[styles.settingsBox, { backgroundColor: theme.card }]}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 15,
              }}
            >
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: 'bold' }}>
                Tmavý režim
              </Text>
              <Switch value={darkMode} onValueChange={setDarkMode} />
            </View>

            {!editingEnabled && (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.inputText }]}
                  placeholder="Heslo"
                  placeholderTextColor={theme.inputPlaceholder}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity style={styles.unlockButton} onPress={unlockEditing}>
                  <Text style={styles.unlockButtonText}>Zapnúť editovanie</Text>
                </TouchableOpacity>
              </>
            )}

            {editingEnabled && (
              <TouchableOpacity
                style={[styles.unlockButton, { backgroundColor: '#ff5252' }]}
                onPress={() => setEditingEnabled(false)}
              >
                <Text style={styles.unlockButtonText}>Vypnúť editovanie</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.row}>
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: theme.buttonInactiveBg },
              shiftType === 'morning' && styles.active,
            ]}
            onPress={() => switchShift('morning')}
          >
            <Text style={{ color: shiftType === 'morning' ? '#111111' : theme.buttonInactiveText }}>
              Ranná
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: theme.buttonInactiveBg },
              shiftType === 'lunch' && styles.active,
            ]}
            onPress={() => switchShift('lunch')}
          >
            <Text style={{ color: shiftType === 'lunch' ? '#111111' : theme.buttonInactiveText }}>
              Obedná
            </Text>
          </TouchableOpacity>
        </View>

        {/* BEFORE SHIFT */}
        <Text style={[styles.section, { color: theme.text }]}>Pred zmenou</Text>

        {checklist.map((item, index) => (
          <View key={index} style={[styles.checkRow, { backgroundColor: theme.rowBg }]}>
            <TextInput
              style={[styles.editableLabel, { color: theme.rowText }]}
              value={item}
              editable={editingEnabled}
              onChangeText={(value) => updateChecklist('before', index, value)}
            />
            {editingEnabled && (
              <TouchableOpacity onPress={() => deleteChecklistItem('before', index)}>
                <Text style={{ color: 'red', marginRight: 10 }}>X</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.checkbox,
                { backgroundColor: theme.checkboxBg, borderColor: theme.checkboxBorder },
                checks[`${shiftType}_before_${index}`] && (darkMode ? { backgroundColor: '#1a5c38' } : styles.greenCheckbox),
              ]}
              onPress={() => toggleCheck(`${shiftType}_before_${index}`)}
            >
              <Text style={{ color: theme.checkmarkColor }}>
                {checks[`${shiftType}_before_${index}`] ? '✓' : ''}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {editingEnabled && (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => addChecklistItem('before')}
          >
            <Text style={styles.resetButtonText}>PRIDAŤ POLÍČKO</Text>
          </TouchableOpacity>
        )}

        {/* DURING SHIFT */}
        <Text style={[styles.section, { color: theme.text }]}>Počas zmeny</Text>

        {duringChecklist.map((item, index) => (
          <View key={index} style={[styles.checkRow, { backgroundColor: theme.rowBg }]}>
            <TextInput
              style={[styles.editableLabel, { color: theme.rowText }]}
              value={item}
              editable={editingEnabled}
              onChangeText={(value) => updateChecklist('during', index, value)}
            />
            {editingEnabled && (
              <TouchableOpacity onPress={() => deleteChecklistItem('during', index)}>
                <Text style={{ color: 'red', marginRight: 10 }}>X</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.checkbox,
                { backgroundColor: theme.checkboxBg, borderColor: theme.checkboxBorder },
                duringChecks[`${shiftType}_during_${index}`] && (darkMode ? { backgroundColor: '#1a5c38' } : styles.greenCheckbox),
              ]}
              onPress={() => toggleDuringCheck(`${shiftType}_during_${index}`)}
            >
              <Text style={{ color: theme.checkmarkColor }}>
                {duringChecks[`${shiftType}_during_${index}`] ? '✓' : ''}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {editingEnabled && (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => addChecklistItem('during')}
          >
            <Text style={styles.resetButtonText}>PRIDAŤ POLÍČKO</Text>
          </TouchableOpacity>
        )}

        {/* WALKTHROUGHS */}
        <Text style={[styles.section, { color: theme.text }]}>Obhliadky prevádzky</Text>

        <View style={styles.walkContainer}>
          {tableData.map((row, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.walkTimeBox,
                {
                  backgroundColor: theme.walkBoxBg,
                  borderColor: theme.walkBoxBorder,
                },
                walkChecks[`${shiftType}_walk_${index}`] && (darkMode ? { backgroundColor: '#1a5c38' } : styles.greenTimeBox),
              ]}
              onPress={() => toggleWalkCheck(`${shiftType}_walk_${index}`)}
            >
              <TextInput
                style={[styles.walkTimeText, { color: theme.walkBoxText }]}
                value={walkTimes[index] || `${row.hour}:00`}
                editable={editingEnabled}
                onChangeText={(value) => updateWalkTime(index, value)}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* PLAN / REALITY */}
        <Text style={[styles.section, { color: theme.text }]}>Plan / Realita</Text>

        <ScrollView horizontal>
          <View>
            <View style={styles.tableHeader}>
              {editingEnabled && (
                <Text
                  style={[
                    styles.cell,
                    {
                      width: 36,
                      backgroundColor: theme.tableHeaderBg,
                      color: theme.tableHeaderText,
                      borderColor: theme.tableBorder,
                    },
                  ]}
                >
                  {''}
                </Text>
              )}
              {['Hod', 'Sales Plan', 'Sales Real', 'TC Plan', 'TC Real', 'MFY', 'R2P', 'SEND', 'Del'].map(
                (label, i) => (
                  <Text
                    key={label}
                    style={[
                      styles.cell,
                      {
                        width: colWidths[i],
                        backgroundColor: theme.tableHeaderBg,
                        color: theme.tableHeaderText,
                        borderColor: theme.tableBorder,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                )
              )}
            </View>

            {tableData.map((row, index) => (
              <View key={index} style={styles.tableRow}>
                {editingEnabled && (
                  <TouchableOpacity
                    style={[
                      styles.inputCell,
                      {
                        width: 36,
                        backgroundColor: theme.tableCellBg,
                        borderColor: theme.tableBorder,
                        justifyContent: 'center',
                        alignItems: 'center',
                      },
                    ]}
                    onPress={() => deleteTableRow(index)}
                  >
                    <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 14 }}>✕</Text>
                  </TouchableOpacity>
                )}
                <TextInput
                  style={[
                    styles.inputCell,
                    {
                      width: colWidths[0],
                      backgroundColor: theme.tableCellBg,
                      color: theme.tableCellText,
                      borderColor: theme.tableBorder,
                    },
                  ]}
                  value={row.hour}
                  onChangeText={(value) => updateRow(index, 'hour', value)}
                />
                {(
                  ['salesPlan', 'salesReality', 'tcPlan', 'tcReality', 'mfy', 'r2p', 'sendKuch', 'del'] as const
                ).map((field, fi) => {
                  const isSalesReality = field === 'salesReality';
                  const isTcReality = field === 'tcReality';
                  const isSpecial = field === 'mfy' || field === 'r2p';
                  return (
                    <TextInput
                      key={field}
                      style={[
                        styles.inputCell,
                        {
                          width: colWidths[fi + 1],
                          backgroundColor: theme.tableCellBg,
                          color: theme.tableCellText,
                          borderColor: theme.tableBorder,
                        },
                        isSpecial && {
                          backgroundColor: theme.tableSpecialBg,
                          color: theme.tableSpecialText,
                        },
                        isSalesReality && {
                          backgroundColor: getPerformanceColor(row.salesPlan, row.salesReality),
                          color: theme.tableCellText,
                        },
                        isTcReality && {
                          backgroundColor: getPerformanceColor(row.tcPlan, row.tcReality),
                          color: theme.tableCellText,
                        },
                      ]}
                      value={row[field]}
                      onChangeText={(value) => updateRow(index, field, value)}
                      editable
                      keyboardType="numeric"
                    />
                  );
                })}
              </View>
            ))}

            <View style={styles.tableRow}>
              {editingEnabled && (
                <View
                  style={[
                    styles.sumCell,
                    {
                      width: 36,
                      backgroundColor: theme.tableSumBg,
                      borderColor: theme.tableBorder,
                    },
                  ]}
                />
              )}
              {[
                'SUM',
                String(calculateSum('salesPlan')),
                String(calculateSum('salesReality')),
                String(calculateSum('tcPlan')),
                String(calculateSum('tcReality')),
                String(calculateSum('mfy')),
                calculateAverage(),
                String(calculateSum('sendKuch')),
                String(calculateSum('del')),
              ].map((val, i) => (
                <Text
                  key={i}
                  style={[
                    styles.sumCell,
                    {
                      width: colWidths[i],
                      backgroundColor: theme.tableSumBg,
                      color: theme.tableSumText,
                      borderColor: theme.tableBorder,
                    },
                  ]}
                >
                  {val}
                </Text>
              ))}
            </View>
          </View>
        </ScrollView>

        {editingEnabled && (
          <TouchableOpacity style={styles.resetButton} onPress={addTableRow}>
            <Text style={styles.resetButtonText}>PRIDAŤ RIADOK</Text>
          </TouchableOpacity>
        )}

        {/* HOURS */}
        <Text style={[styles.section, { color: theme.text }]}>Hodiny</Text>

        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, color: theme.inputText }]}
          placeholder="Počet hodín"
          placeholderTextColor={theme.inputPlaceholder}
          value={hoursWorked}
          onChangeText={setHoursWorked}
          editable
          keyboardType="numeric"
        />

        {/* PRODUCTIVITY */}
        <Text style={[styles.section, { color: theme.text }]}>Produktivita</Text>

        <View style={[styles.productivityBox, { backgroundColor: theme.productivityBg }]}>
          <Text style={[styles.productivityText, { color: theme.productivityText }]}>
            Plan Sales / TC: {calculateProductivity('salesPlan')} /{' '}
            {calculateProductivity('tcPlan')}
          </Text>
          <Text style={[styles.productivityText, { color: theme.productivityText }]}>
            Real Sales / TC: {calculateProductivity('salesReality')} /{' '}
            {calculateProductivity('tcReality')}
          </Text>
        </View>

        {/* NOTES */}
        <Text style={[styles.section, { color: theme.text }]}>Poznámky</Text>

        <View
          style={[
            styles.notesContainer,
            { backgroundColor: theme.notesBg, borderColor: theme.notesBorder },
          ]}
        >
          <TextInput
            style={[styles.notesInput, { color: theme.notesText }]}
            placeholder="Sem môžeš zapisovať poznámky..."
            placeholderTextColor={theme.notesPlaceholder}
            multiline
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* AFTER SHIFT */}
        <Text style={[styles.section, { color: theme.text }]}>Po zmene</Text>

        {afterChecklist.map((item, index) => (
          <View key={index} style={[styles.checkRow, { backgroundColor: theme.rowBg }]}>
            <TextInput
              style={[styles.editableLabel, { color: theme.rowText }]}
              value={item}
              editable={editingEnabled}
              onChangeText={(value) => updateChecklist('after', index, value)}
            />
            {editingEnabled && (
              <TouchableOpacity onPress={() => deleteChecklistItem('after', index)}>
                <Text style={{ color: 'red', marginRight: 10 }}>X</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.checkbox,
                { backgroundColor: theme.checkboxBg, borderColor: theme.checkboxBorder },
                afterChecks[`${shiftType}_after_${index}`] && (darkMode ? { backgroundColor: '#1a5c38' } : styles.greenCheckbox),
              ]}
              onPress={() => toggleAfterCheck(`${shiftType}_after_${index}`)}
            >
              <Text style={{ color: theme.checkmarkColor }}>
                {afterChecks[`${shiftType}_after_${index}`] ? '✓' : ''}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {editingEnabled && (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => addChecklistItem('after')}
          >
            <Text style={styles.resetButtonText}>PRIDAŤ POLÍČKO</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.resetButton} onPress={resetShift}>
          <Text style={styles.resetButtonText}>RESET ZMENY</Text>
        </TouchableOpacity>

        <View style={styles.footerContainer}>
          <Text style={styles.footerTitle}>CREATED BY</Text>
          <Text style={styles.footerName}>Róbert Rosenberger</Text>
          <Text style={styles.footerSub}>Shift Checklist</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const lightTheme = {
  background: '#f2f2f2',
  card: '#ffffff',
  text: '#111111',
  subText: '#666666',
  icon: '#111111',
  inputBg: '#ffffff',
  inputText: '#111111',
  inputPlaceholder: '#aaaaaa',
  rowBg: '#ffffff',
  rowText: '#111111',
  checkboxBg: '#ffffff',
  checkboxBorder: '#999999',
  checkmarkColor: '#111111',
  buttonInactiveBg: '#dddddd',
  buttonInactiveText: '#111111',
  walkBoxBg: '#ffffff',
  walkBoxBorder: '#cccccc',
  walkBoxText: '#111111',
  tableBorder: '#cccccc',
  tableHeaderBg: '#ffe066',
  tableHeaderText: '#111111',
  tableCellBg: '#fff9c4',
  tableCellText: '#111111',
  tableSpecialBg: '#d6f0ff',
  tableSpecialText: '#111111',
  tableSumBg: '#dfe6e9',
  tableSumText: '#111111',
  productivityBg: '#ffffff',
  productivityText: '#111111',
  notesBg: '#ffffff',
  notesBorder: '#d9d9d9',
  notesText: '#222222',
  notesPlaceholder: '#aaaaaa',
};

const darkTheme = {
  background: '#0d0d0d',
  card: '#1c1c1c',
  text: '#f0f0f0',
  subText: '#a0a0a0',
  icon: '#f0f0f0',
  inputBg: '#252525',
  inputText: '#f0f0f0',
  inputPlaceholder: '#666666',
  rowBg: '#1c1c1c',
  rowText: '#eeeeee',
  checkboxBg: '#2e2e2e',
  checkboxBorder: '#555555',
  checkmarkColor: '#ffffff',
  buttonInactiveBg: '#2e2e2e',
  buttonInactiveText: '#cccccc',
  walkBoxBg: '#1c1c1c',
  walkBoxBorder: '#404040',
  walkBoxText: '#eeeeee',
  tableBorder: '#3a3a3a',
  tableHeaderBg: '#2e2600',
  tableHeaderText: '#ffd84d',
  tableCellBg: '#1e1b00',
  tableCellText: '#e8e8e8',
  tableSpecialBg: '#001e2e',
  tableSpecialText: '#7dd4f5',
  tableSumBg: '#1a2428',
  tableSumText: '#d0e8f0',
  productivityBg: '#1c1c1c',
  productivityText: '#eeeeee',
  notesBg: '#1c1c1c',
  notesBorder: '#383838',
  notesText: '#e0e0e0',
  notesPlaceholder: '#555555',
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  topRightSettings: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 6,
    borderRadius: 10,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
    paddingBottom: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  date: {
    marginBottom: 10,
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#ddd',
    alignItems: 'center',
  },
  active: {
    backgroundColor: '#f7d44c',
  },
  section: {
    fontSize: 22,
    fontWeight: 'bold',
    marginVertical: 12,
  },
  checkRow: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    flex: 1,
  },
  editableLabel: {
    flex: 1,
    fontSize: 15,
  },
  checkbox: {
    width: 30,
    height: 30,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  checkedBox: {
    backgroundColor: '#7DFFB3',
  },
  greenCheckbox: {
    backgroundColor: '#7DFFB3',
  },
  walkContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  walkTimeBox: {
    width: '30%',
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  greenTimeBox: {
    backgroundColor: '#7DFFB3',
  },
  walkTimeText: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  tableHeader: {
    flexDirection: 'row',
  },
  tableRow: {
    flexDirection: 'row',
  },
  cell: {
    width: 66,
    padding: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#ffe066',
    textAlign: 'center',
    fontSize: 12,
  },
  inputCell: {
    width: 66,
    padding: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff9c4',
    textAlign: 'center',
    fontSize: 12,
  },
  sumCell: {
    width: 66,
    padding: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#dfe6e9',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 12,
  },
  productivityBox: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  productivityText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  settingsBox: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  unlockButton: {
    backgroundColor: '#f7d44c',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  unlockButtonText: {
    fontWeight: 'bold',
  },
  resetButton: {
    backgroundColor: '#ff5252',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  resetButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  notesContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#d9d9d9',
  },
  notesInput: {
    minHeight: 140,
    textAlignVertical: 'top',
    fontSize: 16,
    color: '#222',
  },
  footerContainer: {
    backgroundColor: '#1565c0',
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 35,
    marginBottom: 40,
  },
  footerTitle: {
    color: '#bbdefb',
    fontSize: 13,
    letterSpacing: 2,
  },
  footerName: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: 'bold',
    marginTop: 8,
  },
  footerSub: {
    color: '#e3f2fd',
    marginTop: 8,
    fontSize: 14,
  },
});
