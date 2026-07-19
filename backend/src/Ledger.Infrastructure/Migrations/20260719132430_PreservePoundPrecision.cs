using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ledger.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PreservePoundPrecision : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "WeightKg",
                table: "WeighIns",
                type: "decimal(7,3)",
                precision: 7,
                scale: 3,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(6,1)",
                oldPrecision: 6,
                oldScale: 1);

            migrationBuilder.AlterColumn<decimal>(
                name: "GoalWeightKg",
                table: "OnboardingDrafts",
                type: "decimal(7,3)",
                precision: 7,
                scale: 3,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(6,1)",
                oldPrecision: 6,
                oldScale: 1,
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "CurrentWeightKg",
                table: "OnboardingDrafts",
                type: "decimal(7,3)",
                precision: 7,
                scale: 3,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(6,1)",
                oldPrecision: 6,
                oldScale: 1,
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "StartWeightKg",
                table: "Goals",
                type: "decimal(7,3)",
                precision: 7,
                scale: 3,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(6,1)",
                oldPrecision: 6,
                oldScale: 1);

            migrationBuilder.AlterColumn<decimal>(
                name: "GoalWeightKg",
                table: "Goals",
                type: "decimal(7,3)",
                precision: 7,
                scale: 3,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(6,1)",
                oldPrecision: 6,
                oldScale: 1);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "WeightKg",
                table: "WeighIns",
                type: "decimal(6,1)",
                precision: 6,
                scale: 1,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(7,3)",
                oldPrecision: 7,
                oldScale: 3);

            migrationBuilder.AlterColumn<decimal>(
                name: "GoalWeightKg",
                table: "OnboardingDrafts",
                type: "decimal(6,1)",
                precision: 6,
                scale: 1,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(7,3)",
                oldPrecision: 7,
                oldScale: 3,
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "CurrentWeightKg",
                table: "OnboardingDrafts",
                type: "decimal(6,1)",
                precision: 6,
                scale: 1,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(7,3)",
                oldPrecision: 7,
                oldScale: 3,
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "StartWeightKg",
                table: "Goals",
                type: "decimal(6,1)",
                precision: 6,
                scale: 1,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(7,3)",
                oldPrecision: 7,
                oldScale: 3);

            migrationBuilder.AlterColumn<decimal>(
                name: "GoalWeightKg",
                table: "Goals",
                type: "decimal(6,1)",
                precision: 6,
                scale: 1,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "decimal(7,3)",
                oldPrecision: 7,
                oldScale: 3);
        }
    }
}
