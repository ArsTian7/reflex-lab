/* =====================================================================
 *  头像：12 个内置动物形象 + 上传图片
 *  只用内联 SVG，无需任何图片资源，任意尺寸都清晰。
 * ===================================================================== */
(function () {
  'use strict';

  var uid = 0;
  var INK = '#2b2f3a';

  /* ---------- 通用零件 ---------- */
  function mouthW(c) {
    return '<path d="M42.4 61.4q2.8 4.6 5.6 0q2.8 4.6 5.6 0" fill="none" stroke="' + c.stroke +
      '" stroke-width="1.7" stroke-linecap="round"/>';
  }
  function mouthSmile(c) {
    return '<path d="M41.6 61.2q6.4 7.4 12.8 0" fill="none" stroke="' + c.stroke +
      '" stroke-width="1.8" stroke-linecap="round"/>';
  }
  function nose(c, color, y) {
    y = y || 58;
    return '<path d="M44.6 ' + y + 'h6.8l-3.4 3.4z" fill="' + (color || c.stroke) + '" stroke-linejoin="round"/>';
  }
  function blush(c) {
    return '<ellipse cx="29" cy="61.5" rx="5.4" ry="3.5" fill="' + c.inner + '" opacity=".55"/>' +
      '<ellipse cx="67" cy="61.5" rx="5.4" ry="3.5" fill="' + c.inner + '" opacity=".55"/>';
  }
  function eyes(c, y, dx, r) {
    y = y || 50.5; dx = dx || 9.5; r = r || 3.7;
    return '<ellipse cx="' + (48 - dx) + '" cy="' + y + '" rx="' + r + '" ry="' + (r + 0.4) + '" fill="' + INK + '"/>' +
      '<ellipse cx="' + (48 + dx) + '" cy="' + y + '" rx="' + r + '" ry="' + (r + 0.4) + '" fill="' + INK + '"/>' +
      '<circle cx="' + (48 - dx + 1.5) + '" cy="' + (y - 1.4) + '" r="1.25" fill="#fff" opacity=".95"/>' +
      '<circle cx="' + (48 + dx + 1.5) + '" cy="' + (y - 1.4) + '" r="1.25" fill="#fff" opacity=".95"/>';
  }
  function head(c, rx, ry, cy) {
    return '<ellipse cx="48" cy="' + (cy || 52) + '" rx="' + (rx || 29) + '" ry="' + (ry || 27) +
      '" fill="' + c.fur + '"/>';
  }
  function whiskers(c) {
    var s = c.furDark;
    return '<g stroke="' + s + '" stroke-width="1.5" stroke-linecap="round" opacity=".8">' +
      '<path d="M12.5 52.5h9.5"/><path d="M11 59.5h11"/><path d="M12.5 66.5h9.5"/>' +
      '<path d="M74 52.5h9.5"/><path d="M74 59.5h11"/><path d="M74 66.5h9.5"/></g>';
  }
  function earPointy(c) {
    return '<path d="M20.5 41 L28 11 L46.5 26.5 Z" fill="' + c.fur + '"/>' +
      '<path d="M75.5 41 L68 11 L49.5 26.5 Z" fill="' + c.fur + '"/>' +
      '<path d="M26.6 36.5 L30.6 19.5 L39.5 27 Z" fill="' + c.inner + '"/>' +
      '<path d="M69.4 36.5 L65.4 19.5 L56.5 27 Z" fill="' + c.inner + '"/>';
  }
  function earRound(c, r) {
    r = r || 10;
    return '<circle cx="25.5" cy="29.5" r="' + r + '" fill="' + c.fur + '"/>' +
      '<circle cx="70.5" cy="29.5" r="' + r + '" fill="' + c.fur + '"/>' +
      '<circle cx="25.5" cy="29.5" r="' + (r * 0.52) + '" fill="' + c.inner + '" opacity=".85"/>' +
      '<circle cx="70.5" cy="29.5" r="' + (r * 0.52) + '" fill="' + c.inner + '" opacity=".85"/>';
  }
  function earLong(c) {
    return '<g><ellipse cx="33" cy="23" rx="7.6" ry="19" fill="' + c.fur + '" transform="rotate(-11 33 23)"/>' +
      '<ellipse cx="63" cy="23" rx="7.6" ry="19" fill="' + c.fur + '" transform="rotate(11 63 23)"/>' +
      '<ellipse cx="33" cy="24" rx="4" ry="13" fill="' + c.inner + '" transform="rotate(-11 33 24)"/>' +
      '<ellipse cx="63" cy="24" rx="4" ry="13" fill="' + c.inner + '" transform="rotate(11 63 24)"/></g>';
  }
  function earFloppy(c) {
    return '<ellipse cx="23.5" cy="44" rx="9.5" ry="13" fill="' + c.furDark + '" transform="rotate(-18 23.5 44)"/>' +
      '<ellipse cx="72.5" cy="44" rx="9.5" ry="13" fill="' + c.furDark + '" transform="rotate(18 72.5 44)"/>';
  }
  function earTuft(c) {
    return '<path d="M30 30 L20 12 L41 22 Z" fill="' + c.fur + '"/>' +
      '<path d="M66 30 L76 12 L55 22 Z" fill="' + c.fur + '"/>';
  }
  function earPatch(c, color) {
    return '<circle cx="27" cy="28.5" r="10" fill="' + color + '"/>' +
      '<circle cx="69" cy="28.5" r="10" fill="' + color + '"/>';
  }

  /* ---------- 12 只动物 ---------- */
  var PRESETS = [
    {
      id: 'cat', label: '橘猫', bg: ['#FFE9C6', '#FFC98E'],
      vars: { fur: '#FFB167', furDark: '#EE9840', inner: '#FF9AA5', stroke: '#5A4238' },
      draw: function (c) { return earPointy(c) + head(c) + eyes(c) + whiskers(c) + blush(c) + nose(c) + mouthW(c); }
    },
    {
      id: 'shiba', label: '柴犬', bg: ['#FFE3C2', '#F8BC86'],
      vars: { fur: '#F2B980', furDark: '#D8934F', inner: '#FFB3A7', stroke: '#5A4238' },
      draw: function (c) {
        return earFloppy(c) + head(c) +
          '<ellipse cx="48" cy="63.5" rx="12.4" ry="8.8" fill="#FFF8EC"/>' +
          eyes(c) + blush(c) + nose(c, '#5A4238', 59.5) + mouthSmile(c);
      }
    },
    {
      id: 'panda', label: '熊猫', bg: ['#EDF1F7', '#D6DEEA'],
      vars: { fur: '#FCFDFF', furDark: '#B9C3D2', inner: '#FFA8B4', stroke: INK },
      draw: function (c) {
        return earPatch(c, INK) + head(c) +
          '<ellipse cx="37.5" cy="51" rx="8.8" ry="10.4" fill="' + INK + '" transform="rotate(-18 37.5 51)"/>' +
          '<ellipse cx="58.5" cy="51" rx="8.8" ry="10.4" fill="' + INK + '" transform="rotate(18 58.5 51)"/>' +
          '<circle cx="37.5" cy="51" r="4.3" fill="#fff"/><circle cx="58.5" cy="51" r="4.3" fill="#fff"/>' +
          '<circle cx="37.9" cy="51.4" r="2.4" fill="' + INK + '"/><circle cx="58.9" cy="51.4" r="2.4" fill="' + INK + '"/>' +
          '<circle cx="39.2" cy="49.9" r=".95" fill="#fff"/><circle cx="60.2" cy="49.9" r=".95" fill="#fff"/>' +
          blush(c) + nose(c, INK, 60) + mouthW(c);
      }
    },
    {
      id: 'rabbit', label: '白兔', bg: ['#F4ECFF', '#DCCFFF'],
      vars: { fur: '#FDFBFF', furDark: '#D3C6EC', inner: '#FFAFBF', stroke: '#5B4B63' },
      draw: function (c) { return earLong(c) + head(c) + eyes(c) + blush(c) + nose(c, '#FF8FA3', 58.5) + mouthW(c); }
    },
    {
      id: 'fox', label: '狐狸', bg: ['#FFDDCE', '#FFB08F'],
      vars: { fur: '#FF9257', furDark: '#E7713A', inner: '#FF9EB0', stroke: '#5A3A2E' },
      draw: function (c) {
        return earPointy(c) + head(c) +
          '<ellipse cx="48" cy="64.5" rx="13.5" ry="9.6" fill="#FFF6EB"/>' +
          eyes(c) + whiskers(c) + blush(c) + nose(c, '#4A3128', 60) + mouthW(c);
      }
    },
    {
      id: 'bear', label: '棕熊', bg: ['#F0DFC8', '#D5B48A'],
      vars: { fur: '#B77F52', furDark: '#9A663C', inner: '#F0A99A', stroke: '#4A3323' },
      draw: function (c) {
        return earRound(c, 10.5) + head(c) +
          '<ellipse cx="48" cy="64" rx="12.6" ry="9.6" fill="#E9CBA6"/>' +
          eyes(c) + blush(c) + nose(c, '#3F2C1E', 60) + mouthSmile(c);
      }
    },
    {
      id: 'koala', label: '考拉', bg: ['#E7EDF5', '#C3CFDD'],
      vars: { fur: '#A7B3C4', furDark: '#8C99AC', inner: '#FFB6C1', stroke: '#464F5E' },
      draw: function (c) {
        return '<circle cx="21.5" cy="36" r="13.5" fill="' + c.furDark + '"/>' +
          '<circle cx="74.5" cy="36" r="13.5" fill="' + c.furDark + '"/>' +
          '<circle cx="21.5" cy="36" r="7.6" fill="' + c.inner + '" opacity=".75"/>' +
          '<circle cx="74.5" cy="36" r="7.6" fill="' + c.inner + '" opacity=".75"/>' +
          head(c, 27.5, 26) +
          '<ellipse cx="48" cy="63" rx="11" ry="9" fill="' + c.furDark + '"/>' +
          eyes(c, 51, 8.6, 4) + blush(c) + nose(c, '#3C4654', 59.5) + mouthSmile(c);
      }
    },
    {
      id: 'penguin', label: '企鹅', bg: ['#DCF3FF', '#A9DCFB'],
      vars: { fur: '#3A4257', furDark: '#2A3143', inner: '#FFB1B1', stroke: '#26304A' },
      draw: function (c) {
        return head(c, 27, 28, 51) +
          '<ellipse cx="48" cy="55" rx="20" ry="21" fill="#FFFDF7"/>' +
          eyes(c, 49, 8.2, 3.5) +
          '<path d="M42 58.5h12l-6 8z" fill="#FFB020" stroke="#E0910A" stroke-width="1" stroke-linejoin="round"/>' +
          '<ellipse cx="27" cy="60" rx="4.6" ry="3" fill="' + c.inner + '" opacity=".6"/>' +
          '<ellipse cx="69" cy="60" rx="4.6" ry="3" fill="' + c.inner + '" opacity=".6"/>';
      }
    },
    {
      id: 'owl', label: '猫头鹰', bg: ['#EDE2FF', '#C6AEFF'],
      vars: { fur: '#9A82E8', furDark: '#7A5FD4', inner: '#FFC2CE', stroke: '#3E3358' },
      draw: function (c) {
        return earTuft(c) + head(c, 29, 28, 52) +
          '<circle cx="37.5" cy="49.5" r="10.6" fill="#FFFCF4"/>' +
          '<circle cx="58.5" cy="49.5" r="10.6" fill="#FFFCF4"/>' +
          '<circle cx="37.5" cy="49.5" r="5.1" fill="' + c.stroke + '"/>' +
          '<circle cx="58.5" cy="49.5" r="5.1" fill="' + c.stroke + '"/>' +
          '<circle cx="39.2" cy="47.6" r="1.7" fill="#fff"/><circle cx="60.2" cy="47.6" r="1.7" fill="#fff"/>' +
          '<path d="M43 58.5h10l-5 7.2z" fill="#FFB020" stroke="#E0910A" stroke-width="1" stroke-linejoin="round"/>' +
          '<ellipse cx="26" cy="60" rx="4.6" ry="3" fill="' + c.inner + '" opacity=".55"/>' +
          '<ellipse cx="70" cy="60" rx="4.6" ry="3" fill="' + c.inner + '" opacity=".55"/>';
      }
    },
    {
      id: 'frog', label: '青蛙', bg: ['#DDF7D4', '#A9E894'],
      vars: { fur: '#6FD469', furDark: '#4FB84C', inner: '#FFB0B8', stroke: '#2F6B33' },
      draw: function (c) {
        return '<circle cx="29" cy="26" r="10.5" fill="' + c.fur + '"/>' +
          '<circle cx="67" cy="26" r="10.5" fill="' + c.fur + '"/>' +
          '<circle cx="29" cy="26" r="7.2" fill="#FFFDF6"/><circle cx="67" cy="26" r="7.2" fill="#FFFDF6"/>' +
          '<circle cx="29" cy="26.8" r="3.5" fill="' + INK + '"/><circle cx="67" cy="26.8" r="3.5" fill="' + INK + '"/>' +
          '<circle cx="30.3" cy="25.2" r="1.2" fill="#fff"/><circle cx="68.3" cy="25.2" r="1.2" fill="#fff"/>' +
          head(c, 29, 23, 56) +
          '<path d="M36 54q12 12 24 0" fill="none" stroke="' + c.stroke + '" stroke-width="2.4" stroke-linecap="round"/>' +
          '<ellipse cx="27.5" cy="62" rx="5" ry="3.2" fill="' + c.inner + '" opacity=".6"/>' +
          '<ellipse cx="68.5" cy="62" rx="5" ry="3.2" fill="' + c.inner + '" opacity=".6"/>';
      }
    },
    {
      id: 'chick', label: '小鸡', bg: ['#FFF6D2', '#FFE28A'],
      vars: { fur: '#FFD84D', furDark: '#F0BE28', inner: '#FFA6A6', stroke: '#8A6A17' },
      draw: function (c) {
        return '<path d="M42 20q6 -12 12 0z" fill="' + c.furDark + '"/>' +
          head(c, 28, 27) + eyes(c, 48, 9, 3.6) +
          '<path d="M42.5 57h11l-5.5 7.5z" fill="#FF9E2C" stroke="#E07F14" stroke-width="1" stroke-linejoin="round"/>' +
          blush(c) + nose(c, 'transparent', 0);
      }
    },
    {
      id: 'pig', label: '小猪', bg: ['#FFE4EE', '#FFB7D2'],
      vars: { fur: '#FFA9C6', furDark: '#EE85AA', inner: '#FF7BA5', stroke: '#7C4560' },
      draw: function (c) {
        return '<path d="M22 36 L24 16 L42 26 Z" fill="' + c.furDark + '"/>' +
          '<path d="M74 36 L72 16 L54 26 Z" fill="' + c.furDark + '"/>' +
          head(c, 29, 27) + eyes(c, 47.5, 10, 3.4) +
          '<ellipse cx="48" cy="62" rx="9.6" ry="7.4" fill="' + c.furDark + '"/>' +
          '<circle cx="45" cy="62" r="1.6" fill="#8A4A66"/><circle cx="51" cy="62" r="1.6" fill="#8A4A66"/>' +
          '<ellipse cx="26.5" cy="59" rx="4.8" ry="3.2" fill="' + c.inner + '" opacity=".5"/>' +
          '<ellipse cx="69.5" cy="59" rx="4.8" ry="3.2" fill="' + c.inner + '" opacity=".5"/>';
      }
    }
  ];

  var byId = {};
  PRESETS.forEach(function (p) { byId[p.id] = p; });

  /* ---------- 生成 SVG ---------- */
  function svg(value, opts) {
    opts = opts || {};
    var p = byId[value] || PRESETS[0];
    var c = p.vars;
    var g = 'ag' + (++uid);
    var body = p.draw(c);
    var border = opts.border ? '<rect x=".75" y=".75" width="94.5" height="94.5" rx="23" fill="none" ' +
      'stroke="' + (opts.borderColor || 'rgba(255,255,255,.28)') + '" stroke-width="1.5"/>' : '';

    return '<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      p.label + '" class="animal-svg">' +
      '<defs><linearGradient id="' + g + '" x1="0" y1="0" x2="0.6" y2="1">' +
      '<stop offset="0" stop-color="' + p.bg[0] + '"/><stop offset="1" stop-color="' + p.bg[1] + '"/>' +
      '</linearGradient></defs>' +
      '<rect width="96" height="96" rx="23" fill="url(#' + g + ')"/>' +
      '<circle cx="24" cy="20" r="26" fill="#fff" opacity=".18"/>' +
      body + border + '</svg>';
  }

  function isImage(value) {
    return typeof value === 'string' && value.indexOf('data:image/') === 0;
  }

  function html(value, opts) {
    if (isImage(value)) {
      return '<img class="animal-img" src="' + value + '" alt="自定义头像" />';
    }
    return svg(String(value || '').replace(/^preset:/, ''), opts);
  }

  function label(value) {
    if (isImage(value)) return '自定义图片';
    var p = byId[String(value || '').replace(/^preset:/, '')];
    return p ? p.label : '橘猫';
  }

  /* 把任意形状的上传图片压成 96px 的正方形 data URL。
     webp 优先；浏览器不支持时退回 jpeg（透明 PNG 在有些浏览器上会膨胀到几十 KB，
     直接存进数据库会让整个榜单变慢，所以这里做二次编码 + 体积兜底）。 */
  function compressImage(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        try {
          var size = 96;
          var cv = document.createElement('canvas');
          cv.width = size; cv.height = size;
          var ctx = cv.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);
          var scale = Math.max(size / img.width, size / img.height);
          var w = img.width * scale, h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

          var out = cv.toDataURL('image/webp', 0.8);
          if (out.indexOf('data:image/webp') !== 0 || out.length > 12000) {
            var jpg = cv.toDataURL('image/jpeg', 0.82);
            if (jpg.length < out.length) out = jpg;
          }
          if (out.length > 15000) {
            cb(new Error('头像压缩后仍然太大，换一张更简单的图片试试'));
            return;
          }
          cb(null, out);
        } catch (e) { cb(e); }
      };
      img.onerror = function () { cb(new Error('图片读取失败')); };
      img.src = reader.result;
    };
    reader.onerror = function () { cb(new Error('文件读取失败')); };
    reader.readAsDataURL(file);
  }

  window.ReflexAvatars = {
    PRESETS: PRESETS,
    svg: svg,
    html: html,
    label: label,
    isImage: isImage,
    compressImage: compressImage,
  };
})();
