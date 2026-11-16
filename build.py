# Builds index.html from src/app.template.html + src/parser.js
s = open('src/app.template.html').read()
s = (s.replace('/*__PARSER__*/', open('src/parser.js').read())
      .replace('__URL__', 'https://ofihffczgcjysdjbjylv.supabase.co')
      .replace('__KEY__', 'sb_publishable_tsMTPt2vuOrk9ed5NVlgdQ_m7H4RWDk'))
open('index.html', 'w').write(s)
