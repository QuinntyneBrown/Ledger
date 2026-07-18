using Ledger.Domain;
using Xunit;

namespace Ledger.UnitTests;

public sealed class WeightMathTests
{
    // Traces to: L2-021, L2-022, L2-024, L2-045
    [Theory]
    [InlineData(100, 80, 90, 50)]
    [InlineData(60, 70, 65, 50)]
    [InlineData(100, 80, 75, 100)]
    public void Percent_complete_handles_loss_gain_and_clamping(decimal start, decimal goal, decimal current, decimal expected) => Assert.Equal(expected, WeightMath.PercentComplete(start, goal, current));

    // Traces to: L2-045
    [Fact]
    public void Unit_round_trip_does_not_drift_canonical_value()
    {
        const decimal kg = 72.4m;
        Assert.Equal(kg, WeightMath.ToKilograms(WeightMath.FromKilograms(kg, WeightUnit.Lbs), WeightUnit.Lbs));
    }

    // Traces to: L2-028, L2-042
    [Fact]
    public void Bmi_uses_metric_formula() => Assert.Equal(22.9m, WeightMath.Bmi(70.2m, 175m));
}

public sealed class StreakTests
{
    // Traces to: L2-035
    [Fact]
    public void Current_streak_may_end_yesterday_and_longest_is_retained()
    {
        var today = new DateOnly(2026, 7, 18); var result = StreakCalculator.Calculate([today.AddDays(-4), today.AddDays(-3), today.AddDays(-2), today.AddDays(-1)], today, 9);
        Assert.Equal(4, result.Current); Assert.Equal(9, result.Longest);
    }

    // Traces to: L2-035
    [Fact]
    public void Missed_day_resets_current_run() { var today = new DateOnly(2026, 7, 18); var result = StreakCalculator.Calculate([today.AddDays(-4), today], today); Assert.Equal(1, result.Current); Assert.Equal(1, result.Longest); }
}

public sealed class PreferenceTests
{
    // Traces to: L2-050, L2-051
    [Theory]
    [InlineData(23, true)]
    [InlineData(6, true)]
    [InlineData(12, false)]
    public void Quiet_hours_handle_midnight(int hour, bool expected)
    {
        var p = new Preferences { QuietHoursEnabled = true, QuietHoursStart = new(22, 0), QuietHoursEnd = new(7, 0) };
        Assert.Equal(expected, p.IsWithinQuietHours(new TimeOnly(hour, 0)));
    }
}

public sealed class TrendTests
{
    // Traces to: L2-023
    [Fact]
    public void Projection_requires_seven_day_span()
    {
        var today = new DateOnly(2026, 7, 18); var goal = new Goal { StartWeightKg = 80, GoalWeightKg = 70, TargetDate = today.AddDays(100) };
        var result = TrendCalculator.Project([new WeighIn { Date = today.AddDays(-3), WeightKg = 80 }, new WeighIn { Date = today, WeightKg = 79 }], goal, today);
        Assert.Null(result.ProjectedDate); Assert.Equal("Keep logging to see your pace", result.Message);
    }

    // Traces to: L2-023
    [Fact]
    public void Regression_projects_toward_loss_goal()
    {
        var today = new DateOnly(2026, 7, 18); var goal = new Goal { StartWeightKg = 80, GoalWeightKg = 70, TargetDate = today.AddDays(90) };
        var values = Enumerable.Range(0, 15).Select(i => new WeighIn { Date = today.AddDays(i - 14), WeightKg = 80m - i * .1m }).ToArray();
        var result = TrendCalculator.Project(values, goal, today); Assert.NotNull(result.ProjectedDate); Assert.True(result.WeeklyRateKg < 0);
    }
}
