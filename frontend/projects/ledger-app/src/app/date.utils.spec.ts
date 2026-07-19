import { localCalendarDate } from "./date.utils";

describe("localCalendarDate", () => {
  it("uses the browser calendar date instead of the UTC date", () => {
    const localLateEvening = new Date(2026, 6, 18, 23, 30);

    expect(localCalendarDate(localLateEvening)).toBe("2026-07-18");
  });
});
