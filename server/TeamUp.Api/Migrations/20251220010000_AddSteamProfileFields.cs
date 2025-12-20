using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TeamUp.Api.Migrations
{
    public partial class AddSteamProfileFields : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "steam_id",
                table: "users",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "steam_display_name",
                table: "users",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "steam_profile_url",
                table: "users",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "steam_avatar_url",
                table: "users",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "steam_games",
                table: "users",
                type: "text[]",
                nullable: false,
                defaultValue: new List<string>());

            migrationBuilder.AddColumn<List<string>>(
                name: "steam_categories",
                table: "users",
                type: "text[]",
                nullable: false,
                defaultValue: new List<string>());

            migrationBuilder.AddColumn<DateTime>(
                name: "steam_last_synced_at",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "steam_id",
                table: "users");

            migrationBuilder.DropColumn(
                name: "steam_display_name",
                table: "users");

            migrationBuilder.DropColumn(
                name: "steam_profile_url",
                table: "users");

            migrationBuilder.DropColumn(
                name: "steam_avatar_url",
                table: "users");

            migrationBuilder.DropColumn(
                name: "steam_games",
                table: "users");

            migrationBuilder.DropColumn(
                name: "steam_categories",
                table: "users");

            migrationBuilder.DropColumn(
                name: "steam_last_synced_at",
                table: "users");
        }
    }
}
