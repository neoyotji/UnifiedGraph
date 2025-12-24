# UnifiedGraph Gateway

GraphQL API Gateway – Birden çok kaynağı tek şema altında toplayan, siber güvenlik odaklı bir uygulama.

## 🏗️ Mimari

```
┌─────────────────────────────────────────────────────────────────┐
│                        İNTERNET                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS VPC (10.0.0.0/16)                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  Security Group                            │ │
│  │  • SSH (22): GitHub Actions için açık                      │ │
│  │  • GraphQL (4000): Public                                  │ │
│  │  • HTTPS (443): Hazır                                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                      │
│                          ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              EC2 t2.micro (Free Tier)                      │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │                 GraphQL Gateway                      │  │ │
│  │  │  • Rate Limiting (100 req/15min)                     │  │ │
│  │  │  • Query Depth Limit (7)                             │  │ │
│  │  │  • Query Complexity Limit (1000)                     │  │ │
│  │  │  • Helmet.js Security Headers                        │  │ │
│  │  │  • Audit Logging                                     │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                      │
│                          ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   CloudWatch Logs                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 🔐 Güvenlik Özellikleri

### Altyapı (Terraform)
- **VPC İzolasyonu**: Özel ağ alanı (10.0.0.0/16)
- **IMDSv2 Zorunlu**: EC2 metadata güvenliği
- **Şifreli EBS**: Root volume encryption
- **IAM Least Privilege**: Sadece CloudWatch logs yazma yetkisi
- **Security Group**: Minimum port açıklığı

### Uygulama (Express + Apollo)
- **Rate Limiting**: 100 istek / 15 dakika
- **Query Depth Limit**: Maksimum 7 seviye iç içe sorgu
- **Query Complexity**: Maksimum 1000 complexity puanı
- **Helmet.js**: HTTP güvenlik başlıkları
- **CORS**: Yapılandırılabilir origin kısıtlaması
- **Introspection**: Production'da kapalı
- **Audit Logging**: JSON formatında güvenlik logları

### Sunucu (Ansible)
- **SSH Hardening**: Root login kapalı, password auth kapalı
- **Fail2ban**: SSH brute-force koruması
- **UFW Firewall**: Sadece 22, 4000 portları açık
- **Non-root User**: Uygulama `nodeapp` kullanıcısıyla çalışır
- **Log Rotation**: 7 günlük log tutma

### CI/CD (GitHub Actions)
- **npm audit**: Dependency vulnerability scan
- **njsscan**: Node.js SAST
- **Gitleaks**: Secret detection
- **tfsec**: Terraform security scan
- **Terratest**: Altyapı doğrulama testleri
- **Smoke Tests**: Post-deploy doğrulama

## 🚀 Kurulum

### Gereksinimler
- Node.js 18+
- Terraform 1.0+
- Go 1.21+ (Terratest için)
- AWS CLI (yapılandırılmış credentials)
- Ansible

### Yerel Geliştirme

```bash
# Bağımlılıkları kur
npm install

# Geliştirme modunda çalıştır
npm run dev

# Production modunda çalıştır
npm start
```

### AWS'e Deploy

1. **GitHub Secrets Ayarla**:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `SSH_PRIVATE_KEY`

2. **Main branch'e push yap**:
   ```bash
   git push origin main
   ```

3. GitHub Actions otomatik olarak:
   - Security scan yapar
   - Terraform ile altyapıyı kurar
   - Ansible ile sunucuyu yapılandırır
   - Smoke test yapar

### Manuel Deploy

```bash
# Terraform
cd infra
terraform init
terraform apply

# Ansible
cd ansible
ansible-playbook -i inventory.ini playbook.yml
```

## 📁 Proje Yapısı

```
UnifiedGraph/
├── src/
│   ├── index.js        # Ana uygulama (Express + Apollo)
│   ├── loaders.js      # DataLoader (N+1 çözümü)
│   ├── config.js       # Yapılandırma
│   └── security.js     # Güvenlik middleware
├── infra/
│   ├── main.tf         # AWS kaynakları
│   ├── variables.tf    # Değişkenler
│   └── outputs.tf      # Çıktılar
├── ansible/
│   ├── playbook.yml    # Deploy playbook
│   └── templates/      # Konfigürasyon şablonları
├── test/
│   ├── *_test.go       # Terratest dosyaları
│   └── go.mod
└── .github/workflows/
    ├── deploy.yml      # CI/CD pipeline
    └── security-scan.yml
```

## 🧪 Test

### Güvenlik Testleri

```bash
# npm audit
npm audit --audit-level=high

# ESLint security rules
npm run lint

# Terratest (AWS credentials gerekli)
cd test
go test -v -timeout 30m ./...
```

### Manuel Test

```bash
# Health check
curl http://localhost:4000/health

# GraphQL query
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ posts { id title user { name } } }"}'

# Rate limit test (429 beklenir)
for i in {1..150}; do curl -s http://localhost:4000/graphql; done
```

## 📊 Monitoring

CloudWatch Log Groups:
- `/unified-graph/application` - Uygulama logları
- `/unified-graph/security` - Güvenlik olayları

## 📝 Lisans

MIT
