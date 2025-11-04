using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeamUp.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    display_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    age = table.Column<int>(type: "integer", nullable: false),
                    gender = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    photo_url = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    favorite_category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    preference_gender = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    preference_age_min = table.Column<int>(type: "integer", nullable: true),
                    preference_age_max = table.Column<int>(type: "integer", nullable: true),
                    favorite_games = table.Column<List<string>>(type: "text[]", nullable: false),
                    languages = table.Column<List<string>>(type: "text[]", nullable: false),
                    preference_categories = table.Column<List<string>>(type: "text[]", nullable: false),
                    preference_languages = table.Column<List<string>>(type: "text[]", nullable: false),
                    liked = table.Column<List<string>>(type: "text[]", nullable: false),
                    disliked = table.Column<List<string>>(type: "text[]", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_users_email",
                table: "users",
                column: "email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
