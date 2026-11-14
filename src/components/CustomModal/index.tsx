import React from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
} from 'react-native';
import { COLORS } from '../../utils/color';
import { karma } from '../../assets/fonts/fonts';
import { scale, verticalScale } from '../../utils/globalFunction';

interface CustomModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const CustomModal: React.FC<CustomModalProps> = ({
    visible,
    onClose,
    title,
    children,
}) => {
    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.modalContainer}>
                            <View style={styles.header}>
                                <Text style={styles.title}>{title}</Text>
                                <TouchableOpacity
                                    onPress={onClose}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <Text style={styles.closeButton}>✕</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.content}>{children}</View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '90%',
        backgroundColor: COLORS.white,
        borderRadius: scale(12),
        padding: scale(20),
        // maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: verticalScale(15),
    },
    title: {
        fontSize: scale(18),
        fontFamily: karma.f600,
        color: COLORS.gray900,
    },
    closeButton: {
        fontSize: scale(18),
        color: COLORS.slate500,
        fontFamily: karma.f500,
    },
    content: {
        marginTop: verticalScale(5),
    },
});

export default CustomModal;
