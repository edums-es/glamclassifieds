import fs from 'fs';
const path = 'd:/claude/glamclassifieds-main/src/lib/api.ts';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/http:\/\/localhost:3000\/admin/g, '\/admin');
content = content.replace(/Authorization: 'Bearer ADMIN_MOCK_TOKEN',/g, 'Authorization: \Bearer \\,');
fs.writeFileSync(path, content);
