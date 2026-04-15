import { MemoryRouter } from 'react-router-dom';
import '../src/index.css';

/** @type { import('@storybook/react').Preview } */
const preview = {
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    layout: 'centered',
  },
};

export default preview;
