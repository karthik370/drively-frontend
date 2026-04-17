/**
 * DriverBadgesScreen — Skill badges with quiz system
 * ───────────────────────────────────────────────────
 * View all available badges, earned badges, take quizzes
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Modal, ScrollView, InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { getAllBadges, getMyBadges, getBadgeQuiz, submitBadgeQuiz } from '../../services/api';
import { showAlert } from '../../components/common/CustomAlert';
import { G } from '../../constants/glassStyles';

interface Badge {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  quiz?: { id: string; title: string; passingScore: number; timeLimitSec: number };
}

interface EarnedBadge {
  badgeId: string;
  quizScore?: number;
  earnedAt: string;
}

interface QuizQuestion {
  q: string;
  options: string[];
}

const DriverBadgesScreen = ({ navigation }: any) => {
  const [screenReady, setScreenReady] = useState(false);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earned, setEarned] = useState<EarnedBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizModal, setQuizModal] = useState(false);
  const [quizBadge, setQuizBadge] = useState<Badge | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; score: number; correct: number; total: number } | null>(null);

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => setScreenReady(true));
    return () => handle.cancel();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allBadges, myBadges] = await Promise.all([getAllBadges(), getMyBadges()]);
      setBadges(Array.isArray(allBadges) ? allBadges : []);
      setEarned(Array.isArray(myBadges) ? myBadges : []);
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (screenReady) loadData();
  }, [screenReady, loadData]);

  const isEarned = (badgeId: string) => earned.some(e => e.badgeId === badgeId);
  const getScore = (badgeId: string) => earned.find(e => e.badgeId === badgeId)?.quizScore;

  const startQuiz = async (badge: Badge) => {
    if (isEarned(badge.id)) {
      showAlert('Badge Earned', `You already have the "${badge.title}" badge!`);
      return;
    }
    try {
      const quiz = await getBadgeQuiz(badge.id);
      setQuizBadge(badge);
      setQuizQuestions(Array.isArray(quiz?.questions) ? quiz.questions : []);
      setQuizAnswers(new Array(quiz?.questions?.length || 0).fill(-1));
      setCurrentQ(0);
      setResult(null);
      setQuizModal(true);
    } catch (err: any) {
      showAlert('Error', err?.message || 'Failed to load quiz');
    }
  };

  const selectAnswer = (optionIndex: number) => {
    setQuizAnswers(prev => {
      const next = [...prev];
      next[currentQ] = optionIndex;
      return next;
    });
  };

  const submitQuiz = async () => {
    if (!quizBadge) return;
    if (quizAnswers.includes(-1)) {
      showAlert('Incomplete', 'Please answer all questions before submitting');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitBadgeQuiz(quizBadge.id, quizAnswers);
      setResult(res);
      if (res?.passed) {
        await loadData(); // Refresh earned badges
      }
    } catch (err: any) {
      showAlert('Error', err?.message || 'Failed to submit quiz');
    }
    setSubmitting(false);
  };

  const renderBadge = ({ item }: { item: Badge }) => {
    const earned = isEarned(item.id);
    const score = getScore(item.id);

    return (
      <TouchableOpacity
        style={[styles.badgeCard, earned && styles.badgeCardEarned]}
        onPress={() => startQuiz(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.badgeIcon, { backgroundColor: item.color + '22' }]}>
          <Icon name={item.icon as any} size={32} color={item.color} />
        </View>
        <View style={styles.badgeInfo}>
          <Text style={styles.badgeTitle}>{item.title}</Text>
          <Text style={styles.badgeDesc} numberOfLines={2}>{item.description}</Text>
          <View style={styles.badgeMeta}>
            <View style={[styles.categoryTag, { backgroundColor: item.color + '33' }]}>
              <Text style={[styles.categoryText, { color: item.color }]}>{item.category}</Text>
            </View>
            {earned ? (
              <View style={styles.earnedTag}>
                <Icon name="check-circle" size={14} color="#10b981" />
                <Text style={styles.earnedText}>Earned{score != null ? ` (${score}%)` : ''}</Text>
              </View>
            ) : (
              <View style={styles.quizTag}>
                <Icon name="school" size={14} color="#C9A84C" />
                <Text style={styles.quizText}>Take Quiz</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!screenReady || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={24} color="#C9A84C" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🏅 Skill Badges</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#C9A84C" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#C9A84C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏅 Skill Badges</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{earned.length}</Text>
          <Text style={styles.statLabel}>Earned</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{badges.length - earned.length}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{badges.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      <FlatList
        data={badges}
        renderItem={renderBadge}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        removeClippedSubviews
        initialNumToRender={6}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Icon name="shield-star" size={48} color="#666" />
            <Text style={{ color: G.textSecondary, marginTop: 12 }}>No badges available yet</Text>
          </View>
        }
      />

      {/* Quiz Modal */}
      <Modal visible={quizModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{quizBadge?.title || 'Quiz'}</Text>
              <TouchableOpacity onPress={() => setQuizModal(false)}>
                <Icon name="close" size={24} color={G.textSecondary} />
              </TouchableOpacity>
            </View>

            {result ? (
              <View style={styles.resultContainer}>
                <Icon
                  name={result.passed ? 'trophy' : 'close-circle'}
                  size={64}
                  color={result.passed ? '#C9A84C' : '#ef4444'}
                />
                <Text style={[styles.resultTitle, { color: result.passed ? '#10b981' : '#ef4444' }]}>
                  {result.passed ? '🎉 Badge Earned!' : '❌ Not Passed'}
                </Text>
                <Text style={styles.resultScore}>
                  Score: {result.score}% ({result.correct}/{result.total} correct)
                </Text>
                {!result.passed && (
                  <Text style={styles.resultHint}>
                    You need {quizBadge?.quiz?.passingScore || 70}% to pass. Try again!
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.resultBtn, { backgroundColor: result.passed ? '#10b981' : '#C9A84C' }]}
                  onPress={() => { setQuizModal(false); setResult(null); }}
                >
                  <Text style={styles.resultBtnText}>{result.passed ? 'Awesome!' : 'Close'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {quizQuestions.length > 0 && (
                  <>
                    <Text style={styles.qProgress}>
                      Question {currentQ + 1} of {quizQuestions.length}
                    </Text>
                    <Text style={styles.qText}>{quizQuestions[currentQ]?.q}</Text>
                    {quizQuestions[currentQ]?.options.map((opt, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.optionBtn, quizAnswers[currentQ] === i && styles.optionBtnSelected]}
                        onPress={() => selectAnswer(i)}
                      >
                        <View style={[styles.optionRadio, quizAnswers[currentQ] === i && styles.optionRadioSelected]}>
                          {quizAnswers[currentQ] === i && <View style={styles.optionRadioDot} />}
                        </View>
                        <Text style={[styles.optionText, quizAnswers[currentQ] === i && styles.optionTextSelected]}>
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    ))}

                    <View style={styles.navRow}>
                      {currentQ > 0 && (
                        <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentQ(c => c - 1)}>
                          <Icon name="chevron-left" size={20} color="#C9A84C" />
                          <Text style={styles.navBtnText}>Previous</Text>
                        </TouchableOpacity>
                      )}
                      <View style={{ flex: 1 }} />
                      {currentQ < quizQuestions.length - 1 ? (
                        <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentQ(c => c + 1)}>
                          <Text style={styles.navBtnText}>Next</Text>
                          <Icon name="chevron-right" size={20} color="#C9A84C" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                          onPress={submitQuiz}
                          disabled={submitting}
                        >
                          {submitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.submitBtnText}>Submit Quiz</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: G.border3,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: G.textPrimary },
  statsRow: {
    flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 8,
  },
  statCard: {
    flex: 1, backgroundColor: G.glass1, borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: G.border3,
  },
  statNum: { fontSize: 22, fontWeight: '900', color: '#C9A84C' },
  statLabel: { fontSize: 11, color: G.textSecondary, marginTop: 2, fontWeight: '600' },
  list: { padding: 16, paddingTop: 8 },
  badgeCard: {
    flexDirection: 'row', backgroundColor: G.glass1, borderRadius: 16,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: G.border3, gap: 14,
  },
  badgeCardEarned: { borderColor: '#10b981', borderWidth: 1.5 },
  badgeIcon: {
    width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
  },
  badgeInfo: { flex: 1 },
  badgeTitle: { fontSize: 15, fontWeight: '800', color: G.textPrimary },
  badgeDesc: { fontSize: 12, color: G.textSecondary, marginTop: 3, lineHeight: 16 },
  badgeMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  categoryTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryText: { fontSize: 10, fontWeight: '700' },
  earnedTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  earnedText: { fontSize: 11, color: '#10b981', fontWeight: '700' },
  quizTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quizText: { fontSize: 11, color: '#C9A84C', fontWeight: '700' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: G.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: G.textPrimary },
  qProgress: { color: '#C9A84C', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  qText: { fontSize: 16, fontWeight: '700', color: G.textPrimary, marginBottom: 16, lineHeight: 22 },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: G.glass2, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1.5, borderColor: G.border3,
  },
  optionBtnSelected: { borderColor: '#C9A84C', backgroundColor: '#C9A84C15' },
  optionRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#666',
    justifyContent: 'center', alignItems: 'center',
  },
  optionRadioSelected: { borderColor: '#C9A84C' },
  optionRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#C9A84C' },
  optionText: { flex: 1, fontSize: 14, color: G.textSecondary },
  optionTextSelected: { color: G.textPrimary, fontWeight: '600' },
  navRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingBottom: 20 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navBtnText: { color: '#C9A84C', fontSize: 14, fontWeight: '700' },
  submitBtn: {
    backgroundColor: '#C9A84C', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  resultContainer: { alignItems: 'center', paddingVertical: 30 },
  resultTitle: { fontSize: 24, fontWeight: '900', marginTop: 16 },
  resultScore: { fontSize: 16, color: G.textSecondary, marginTop: 8, fontWeight: '600' },
  resultHint: { fontSize: 13, color: G.textSecondary, marginTop: 8, textAlign: 'center' },
  resultBtn: {
    paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, marginTop: 24,
  },
  resultBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

export default DriverBadgesScreen;
