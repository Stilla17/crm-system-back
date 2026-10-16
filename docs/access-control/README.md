# Access Control

Ushbu hujjat CRM backenddagi autentifikatsiya, rollar, permissionlar va kompaniyalararo izolyatsiyaning **joriy implementatsiyasi**ni tushuntiradi.

## 1. Arxitektura

Tizim RBAC (Role-Based Access Control) asosida ishlaydi:

```text
User ── roleId ──> Role ──> permissions[]
  │                   │
  └── companyId       └── scope: system | company
```

- `User` permissionlarni bevosita saqlamaydi; ular userga biriktirilgan `Role`dan olinadi.
- Barcha role’lar global: bitta role turli kompaniyalardagi userlarga biriktirilishi mumkin.
- `company` scope’dagi user qaysi tenantga tegishli ekanini `User.companyId` belgilaydi.
- Himoyalangan har bir requestda user va role bazadan qayta o‘qiladi. Shu sababli role permissionlari yoki faolligi o‘zgarsa, o‘zgarish amaldagi access token tugashini kutmasdan qo‘llanadi.

## 2. Ma’lumotlar modeli

### Role

```ts
interface Role {
  id: string;
  roleName: string;
  scope: 'system' | 'company';
  slug: string;
  permissions: Permission[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

Muhim qoidalar:

- API orqali yaratilgan role har doim `scope: 'company'` bo‘ladi.
- `slug` barcha role’lar bo‘yicha global unique.
- `slug` kichik harflarga o‘tkazilib, ikki chetidagi bo‘sh joylar olib tashlanadi.
- Company role’ga `companies.create` va `companies.delete` permissionlarini berish taqiqlangan.
- Global role yaratish va yangilash faqat system userga ruxsat etiladi.

### User

```ts
interface User {
  id: string;
  companyId?: string | null;
  roleId: string;
  name: string;
  login: string;
  password: string;
  status: 'active' | 'inactive';
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

- System user uchun `companyId: null` bo‘ladi.
- Company user faqat faol `company` scope’dagi global role’ga biriktirilishi mumkin.
- `login` global unique va kichik harflarda saqlanadi.
- Parol va refresh token bazada bcrypt hash ko‘rinishida saqlanadi hamda oddiy query natijasiga kiritilmaydi.

## 3. Autentifikatsiya

Barcha URL’lar `/api/v1` prefiksi bilan boshlanadi.

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json
```

```json
{
  "login": "admin",
  "password": "secret123"
}
```

Muvaffaqiyatli javob:

```json
{
  "message": "Tizimga muvaffaqiyatli kirildi"
}
```

Tokenlar response body’da emas, `HttpOnly` cookie sifatida qaytariladi:

| Cookie         | Amal qilish muddati | Sozlamalar                                         |
| -------------- | ------------------: | -------------------------------------------------- |
| `accessToken`  |           15 daqiqa | `httpOnly`, `sameSite=lax`, production’da `secure` |
| `refreshToken` |               1 kun | `httpOnly`, `sameSite=lax`, production’da `secure` |

JWT payload minimal:

```ts
{
  sub: user.id,
  login: user.login,
}
```

Frontend cookie yuborishi uchun cross-origin requestlarda credentials yoqilgan bo‘lishi kerak:

```ts
fetch(url, {
  method: 'GET',
  credentials: 'include',
});
```

### Profile, refresh va logout

| Method | Endpoint               | Himoya        | Vazifasi                                                     |
| ------ | ---------------------- | ------------- | ------------------------------------------------------------ |
| `GET`  | `/api/v1/auth/profile` | Access token  | Joriy userning auth kontekstini qaytaradi                    |
| `POST` | `/api/v1/auth/refresh` | Refresh token | Ikkala tokenni yangilaydi                                    |
| `POST` | `/api/v1/auth/logout`  | Access token  | Bazadagi refresh tokenni tozalaydi va cookie’larni o‘chiradi |

`profile` javobining ko‘rinishi:

```json
{
  "id": "user-uuid",
  "login": "admin",
  "companyId": "company-uuid",
  "roleId": "role-uuid",
  "roleName": "Director",
  "roleScope": "company",
  "permissions": ["users.read", "roles.read"]
}
```

## 4. Himoyalangan request oqimi

```text
Request
  ↓
JwtAuthGuard: accessToken cookie va imzoni tekshiradi
  ↓
JwtStrategy: user va role’ni bazadan oladi
  ↓
User/role faolligi va scope mosligi tekshiriladi
  ↓
PermissionsGuard: endpoint permissionlarini tekshiradi
  ↓
Controller → Service
```

`JwtStrategy` muvaffaqiyatli ishlagach, `request.user` quyidagi ko‘rinishda bo‘ladi:

```ts
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    companyId: string | null;
    roleId: string;
    roleName: string;
    roleScope: 'system' | 'company';
    permissions: string[];
  };
}
```

Tekshiruvlar:

1. Token ichidagi `sub` bo‘yicha user topiladi.
2. User `active` ekanligi tekshiriladi.
3. `roleId` bo‘yicha role topiladi va `isActive` tekshiriladi.
4. Company role bo‘lsa, userda `companyId` mavjud bo‘lishi shart.
5. System role bo‘lsa, userning `companyId` qiymati `null` bo‘lishi shart.
6. Endpoint talab qilgan barcha permissionlar user role’ida mavjudligi tekshiriladi.

Controllerdagi standart qo‘llanish:

```ts
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.USERS_READ)
@Get()
getAllUsers(@CurrentCompanyId() companyId: string) {
  return this.usersService.getAllUsers(companyId);
}
```

`@RequirePermissions()`ga bir nechta permission berilsa, userda ularning **barchasi** bo‘lishi kerak.

## 5. Company isolation

Company endpointlarida `companyId` body, query yoki URL’dan olinmaydi. U tekshirilgan `request.user`dan `@CurrentCompanyId()` orqali olinadi:

```ts
const companyId = request.user.companyId;
```

Service querylari ham kompaniya bilan cheklanadi:

```ts
find({ companyId });
findOne({ id, companyId });
findOneAndUpdate({ id, companyId }, update);
findOneAndDelete({ id, companyId });
```

Natijada company user boshqa kompaniyaning `id` qiymatini bilsa ham uning user yoki biznes ma’lumotiga kira olmaydi. Role’lar global bo‘lgani uchun `/roles` company kontekstini talab qilmaydi; `/users` va boshqa tenant resurslari esa `@CurrentCompanyId()` bilan cheklanadi.

## 6. Permissionlar

Permission nomlash formati: `resource.action`.

| Resource  | Permissionlar                                                                |
| --------- | ---------------------------------------------------------------------------- |
| Companies | `companies.read`, `companies.create`, `companies.update`, `companies.delete` |
| Roles     | `roles.read`, `roles.create`, `roles.update`, `roles.delete`                 |
| Users     | `users.read`, `users.create`, `users.update`, `users.delete`                 |
| Customers | `customers.read`, `customers.create`, `customers.update`, `customers.delete` |
| Books     | `books.read`, `books.create`, `books.update`, `books.delete`                 |
| Shipments | `shipments.read`, `shipments.create`, `shipments.update`, `shipments.delete` |
| Payments  | `payments.read`, `payments.create`, `payments.update`, `payments.delete`     |

`Permission` enum yagona manba sifatida `src/auth/permissions/permissions.enum.ts` faylida saqlanadi.

Eslatma: permission enum’da mavjud bo‘lishi endpoint implementatsiya qilinganini anglatmaydi. Hozir `customers`, `books`, `shipments` va `payments` controllerlarida endpointlar yo‘q; `roles.delete` uchun ham endpoint mavjud emas.

### Standart role to‘plamlari

- `SUPER_ADMIN_PERMISSIONS` — barcha permissionlar.
- `DIRECTOR_PERMISSIONS` — global role’larni o‘qish hamda user, customer, book, shipment va payment boshqaruvi. Global role yaratish/yangilash kiritilmagan.
- `MANAGER_PERMISSIONS` — customer yaratish/o‘qish/yangilash, book o‘qish, shipment yaratish/o‘qish/yangilash va payment o‘qish.

Bu to‘plamlar `src/auth/permissions/role-permissions.ts` faylida joylashgan.

## 7. Role endpointlari

Barcha role endpointlari access token va permission talab qiladi. Role’lar global bo‘lgani uchun company konteksti ishlatilmaydi.

| Method  | Endpoint            | Permission     | Vazifasi                                   |
| ------- | ------------------- | -------------- | ------------------------------------------ |
| `POST`  | `/api/v1/roles`     | `roles.create` | Global company role yaratadi (system)      |
| `GET`   | `/api/v1/roles`     | `roles.read`   | Global company role’larini oladi           |
| `GET`   | `/api/v1/roles/:id` | `roles.read`   | Bitta global company role’ni oladi         |
| `PATCH` | `/api/v1/roles/:id` | `roles.update` | Global company role’ni yangilaydi (system) |

Role yaratish:

```json
{
  "roleName": "Manager",
  "slug": "manager",
  "permissions": ["customers.read", "customers.create", "shipments.read"],
  "isActive": true
}
```

`companyId` role modelida mavjud emas va `scope` client tomonidan yuborilmaydi. Backend API orqali yaratilgan role’ga `company` scope beradi.

Inactive role’ga user biriktirish taqiqlanadi. Avval biriktirilgan role nofaol qilinsa, user himoyalangan endpointda `401 Unauthorized` oladi.

## 8. User endpointlari

Barcha user endpointlari access token, permission va company kontekstini talab qiladi.

| Method   | Endpoint            | Permission     | Vazifasi                                              |
| -------- | ------------------- | -------------- | ----------------------------------------------------- |
| `POST`   | `/api/v1/users`     | `users.create` | Joriy kompaniyada user yaratadi                       |
| `GET`    | `/api/v1/users`     | `users.read`   | Joriy kompaniya userlarini oladi                      |
| `GET`    | `/api/v1/users/:id` | `users.read`   | Joriy kompaniyadagi bitta userni oladi                |
| `PATCH`  | `/api/v1/users/:id` | `users.update` | Userning `name`, `roleId` yoki `status`ini yangilaydi |
| `DELETE` | `/api/v1/users/:id` | `users.delete` | Joriy kompaniyadagi userni o‘chiradi                  |

User yaratish:

```json
{
  "name": "Ali Valiyev",
  "roleId": "role-uuid",
  "login": "ali",
  "password": "strong-password",
  "status": "active"
}
```

Qoidalar:

- Parol kamida 6 belgidan iborat.
- Role joriy kompaniyaga tegishli bo‘lishi shart.
- Login global miqyosda takrorlanmasligi kerak.
- `PATCH /users/:id` orqali login va parolni o‘zgartirib bo‘lmaydi.
- Oddiy read querylarda schema’dagi `select: false` sababli parol tanlanmaydi. Yangi user yaratish response’i alohida sanitizatsiya qilinmagan — production API’da parol hashini response’dan chiqarib tashlash kerak.

## 9. Company endpointlari

| Method   | Endpoint                | Permission         | Qo‘shimcha cheklov                          |
| -------- | ----------------------- | ------------------ | ------------------------------------------- |
| `GET`    | `/api/v1/companies`     | `companies.read`   | Yo‘q                                        |
| `GET`    | `/api/v1/companies/:id` | `companies.read`   | Yo‘q                                        |
| `POST`   | `/api/v1/companies`     | `companies.create` | Permission company role’ga berilmaydi       |
| `PATCH`  | `/api/v1/companies/:id` | `companies.update` | Yo‘q                                        |
| `DELETE` | `/api/v1/companies/:id` | `companies.delete` | `roleScope === 'system'` ham talab qilinadi |

Company endpointlari global ishlaydi; ular `@CurrentCompanyId()` bilan cheklanmagan. `companies.create` va `companies.delete` system-only permissionlar sifatida belgilangan. O‘chirish endpointi permissiondan tashqari system scope’ni ham alohida tekshiradi.

## 10. Super admin yaratish

Super admin oddiy API orqali emas, idempotent seed orqali yaratiladi:

```bash
npm run seed:super-admin
```

Kerakli environment qiymatlari:

```env
MONGODB_URI=...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
SUPER_ADMIN_LOGIN=...
SUPER_ADMIN_PASSWORD=...
SUPER_ADMIN_NAME=...
```

Seed quyidagilarni yaratadi:

- `scope: 'system'` bo‘lgan global `super-admin` role;
- `scope: 'company'` bo‘lgan global `director` role;
- role’lar uchun tegishli permissionlar;
- `companyId: null` bo‘lgan active super admin user.

Seed qayta ishga tushirilganda mavjud role yoki user takroran yaratilmaydi.

Eski per-company role ma’lumotlarini global modelga bir marta o‘tkazish uchun
`scripts/migrate-global-roles.js` mongosh skripti mavjud. U bir xil role’larning
sozlamalari farq qilsa migratsiyani to‘xtatadi, aks holda backup kolleksiyalar
yaratib, userlarning `roleId` qiymatlarini canonical global role’ga ko‘chiradi.

## 11. HTTP statuslar

| Status | Holat                                                                     |
| -----: | ------------------------------------------------------------------------- |
|  `200` | O‘qish, yangilash, login yoki logout muvaffaqiyatli                       |
|  `201` | Resource yaratildi yoki token refresh qilindi                             |
|  `400` | DTO validation xatosi yoki noma’lum body maydoni                          |
|  `401` | Token yaroqsiz; role topilmadi; user/role faol emas yoki scope mos emas   |
|  `403` | Permission yo‘q, company konteksti yo‘q yoki system-only amal taqiqlangan |
|  `404` | So‘ralgan user, role yoki company topilmadi                               |
|  `409` | Login yoki unique slug takrorlandi                                        |

## 12. Joriy cheklovlar va xavfsizlik eslatmalari

- Login metodining o‘zi user va role faolligini tekshirmaydi. Login cookie qaytarishi mumkin, lekin inactive user yoki role bilan himoyalangan request `401` oladi.
- Refresh oqimi saqlangan token hashini tekshiradi, ammo user statusi, role faolligi va role scope mosligini qayta tekshirmaydi.
- CORS origin hozir kodda `http://localhost:3000` sifatida belgilangan.
- Cookie `sameSite=lax`; frontend va backend turli site’larda joylashsa, production cookie/CORS konfiguratsiyasini moslashtirish kerak.
- Company o‘chirilganda unga tegishli userlar avtomatik o‘chirilmaydi; global role’lar kompaniyaga tegishli emas.
- Role o‘chirish endpointi implementatsiya qilinmagan.
- User yaratish service’i qaytargan yangi document alohida sanitizatsiya qilinmagan; parol hashini response’dan chiqarish lozim.

## 13. Yangi himoyalangan endpoint qo‘shish

1. Permissionni `Permission` enum’ga qo‘shing.
2. Zarur standart role to‘plamlariga kiriting.
3. Controllerga ikkala guardni ulang.
4. Endpointga `@RequirePermissions(Permission.X)` qo‘ying.
5. Company resource bo‘lsa, `companyId`ni faqat `@CurrentCompanyId()`dan oling.
6. Service’dagi barcha read/update/delete querylarini `{ id, companyId }` bilan cheklang.
7. `401`, `403` va boshqa kompaniya ID’si bilan murojaat qilish holatlari uchun test yozing.

```ts
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('example')
export class ExampleController {
  @Get()
  @RequirePermissions(Permission.EXAMPLE_READ)
  findAll(@CurrentCompanyId() companyId: string) {
    return this.exampleService.findAll(companyId);
  }
}
```

## 14. Tekshirish

```bash
npm run build
npm test
npm run test:e2e
npm run lint
```

Access-control o‘zgarishlarida kamida quyidagi holatlar tekshirilishi kerak:

- tokensiz request `401` qaytarishi;
- permissionsiz request `403` qaytarishi;
- inactive user va inactive role `401` qaytarishi;
- company user boshqa kompaniya resource’iga kira olmasligi;
- company role system-only permission ola olmasligi;
- system user company-context endpointidan foydalana olmasligi;
- role permissioni o‘zgargach, yangi permission darhol qo‘llanishi.
