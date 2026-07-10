import { defineStore } from 'pinia';

export interface DailyStats {
  date: string;
  newMistakes: number;
  reviewedMistakes: number;
  newNotes: number;
}

export interface WeeklyStats {
  weekStart: string;
  newMistakes: number;
  reviewedMistakes: number;
}

export interface TopicDistribution {
  name: string;
  value: number;
}

export const useCalendarStore = defineStore('calendar', {
  state: () => ({
    dailyStats: [] as DailyStats[],
    weeklyTrend: [] as WeeklyStats[],
    topicDistribution: [] as TopicDistribution[],
    reviewRate: { reviewed: 0, total: 0 },
    masteryDistribution: { fresh: 0, hesitant: 0, smooth: 0 },
    loading: false,
  }),

  getters: {
    getStatsForDate: (state) => {
      return (date: string) => state.dailyStats.find((d) => d.date === date);
    },
    reviewRatePercent: (state) => {
      if (state.reviewRate.total === 0) return 0;
      return Math.round((state.reviewRate.reviewed / state.reviewRate.total) * 100);
    },
  },

  actions: {
    setDailyStats(stats: DailyStats[]) {
      this.dailyStats = stats;
    },
    setWeeklyTrend(trend: WeeklyStats[]) {
      this.weeklyTrend = trend;
    },
    setTopicDistribution(dist: TopicDistribution[]) {
      this.topicDistribution = dist;
    },
    setReviewRate(reviewed: number, total: number) {
      this.reviewRate = { reviewed, total };
    },
    setMasteryDistribution(fresh: number, hesitant: number, smooth: number) {
      this.masteryDistribution = { fresh, hesitant, smooth };
    },
  },
});
