// Jest manual mock for expo-screen-capture (node env has no window flags).

export const preventScreenCaptureAsync = jest.fn(async (_key?: string): Promise<void> => {});
export const allowScreenCaptureAsync = jest.fn(async (_key?: string): Promise<void> => {});
