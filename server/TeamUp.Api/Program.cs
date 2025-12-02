using Microsoft.EntityFrameworkCore;
using TeamUp.Api.Data;
using TeamUp.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure form options for file uploads (10MB limit)
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 10_000_000;
    options.ValueLengthLimit = 10_000_000;
});

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddHttpClient<MLServiceClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["MLService:BaseUrl"] ?? "http://ml-service:5000");
    client.Timeout = TimeSpan.FromSeconds(30);
});

builder.Services.AddHttpClient<CBServiceClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["CBService:BaseUrl"] ?? "http://cb-service:5001");
    client.Timeout = TimeSpan.FromSeconds(30);
});

builder.Services.AddSingleton<AlgorithmService>();
builder.Services.AddScoped<MetricsService>();
builder.Services.AddScoped<CsvImportService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var context = services.GetRequiredService<ApplicationDbContext>();
    context.Database.EnsureCreated();
    DbInitializer.Initialize(context);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");

app.MapControllers();

app.Run();
