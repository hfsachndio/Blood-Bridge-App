import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../utils/color';
import { scale, verticalScale } from '../../utils/globalFunction';
import { karma } from '../../assets/fonts/fonts';
import { useUser } from '../../context/UserContext';
import { checkEligibility, EligibilityResult } from '../../utils/eligibility';
import { doc, updateDoc, db, serverTimestamp } from '../../config/firebase';
import { getAuth } from '../../config/firebase';

// ── Small reusable components ─────────────────────────────────────────────────

const YesNoQuestion = ({
    label, value, onChange,
}: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={styles.questionRow}>
        <Text style={styles.questionLabel}>{label}</Text>
        <View style={styles.yesNoRow}>
            <TouchableOpacity
                style={[styles.yesNoBtn, value && styles.yesNoBtnActive]}
                onPress={() => onChange(true)}
            >
                <Text style={[styles.yesNoText, v