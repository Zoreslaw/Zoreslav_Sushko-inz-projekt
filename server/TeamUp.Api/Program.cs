using Microsoft.EntityFrameworkCore;
using TeamUp.Api.Data;
using TeamUp.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

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
