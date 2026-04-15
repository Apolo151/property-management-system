import StatCard from './StatCard';

export default {
  title: 'Components/StatCard',
  component: StatCard,
};

export const WithTrend = {
  args: {
    title: 'Occupancy',
    value: '87%',
    trend: 'up',
    trendValue: '3% vs last week',
    icon: <span className="text-2xl">📊</span>,
  },
};
