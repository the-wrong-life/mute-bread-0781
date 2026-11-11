#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""工程计算器独立参考实现（oracle）。

本脚本刻意不复用站点源码 src/scripts/tools/logic.ts，按公开公式与 SI 定义值
从零实现同一组计算，用于给 tools/verify/vectors.json 的用例生成参考结果。

用法：
  python tools/verify/oracle.py                 # 读取 ../verify/vectors.json，生成 expected.json
  python tools/verify/oracle.py --check         # 只校验 expected.json 与本次计算一致

设计原则：
  1. 常数只写 SI 精确值（1 in = 0.0254 m、1 lbf = 4.4482216152605 N 等），
     不从被测代码抄。
  2. 公式按量纲推导，不按实现语句顺序。
  3. 对"未填边 A/B 时展开长记 0"这类产品约定，在 SPEC 中显式声明。
"""

import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
VECTORS = os.path.join(HERE, 'vectors.json')
EXPECTED = os.path.join(HERE, 'expected.json')

# ---- SI 精确/定义值（BIPM 或 NIST SP 811 附录 B）----
INCH = 0.0254            # m，国际英寸定义值
FOOT = 0.3048            # m
POUND = 0.45359237       # kg，国际磅定义值
OUNCE = POUND / 16       # kg
G0 = 9.80665             # m/s^2，标准重力加速度（定义值）
PSI_PA = 6894.757293168361
BAR_PA = 1.0e5
KGF_CM2_PA = 98066.5
HP_W = 745.6998715822702  # 550 ft·lbf/s 的机械马力
LBF_FT_NM = 4.4482216152605 * FOOT
KGF_M_NM = G0
US_GAL_L = 3.785411784
UK_GAL_L = 4.54609

# 换算：所有非温度类别都折算到"基准单位"，再乘回到目标单位。
# 基准单位：长度 m、质量 kg、功率 W、压力 Pa、扭矩 N·m、流量 L/min。
FACTORS = {
    'length': {'mm': 0.001, 'cm': 0.01, 'm': 1.0, 'km': 1000.0, 'in': INCH, 'ft': FOOT},
    'mass': {'g': 0.001, 'kg': 1.0, 'oz': OUNCE, 'lb': POUND},
    'power': {'W': 1.0, 'kW': 1000.0, 'hp': HP_W},
    'pressure': {'Pa': 1.0, 'kPa': 1000.0, 'MPa': 1.0e6, 'bar': BAR_PA,
                 'psi': PSI_PA, 'kgf/cm²': KGF_CM2_PA},
    'torque': {'N·m': 1.0, 'kgf·m': KGF_M_NM, 'lbf·ft': LBF_FT_NM},
    'flow': {'L/min': 1.0, 'L/s': 60.0, 'm³/h': 1000.0 / 60.0,
             'gpm(US)': US_GAL_L, 'gpm(UK)': UK_GAL_L},
}

ABSOLUTE_ZERO = {'°C': -273.15, '°F': -459.67, 'K': 0.0}


def convert_value(n, kind, src, dst):
    if kind == 'temperature':
        # 先化到摄氏度；绝对零度在原始温标上判定
        if n < ABSOLUTE_ZERO[src]:
            raise ValueError('温度不能低于绝对零度；此工具不能用于温差。')
        c = n if src == '°C' else ((n - 32.0) * 5.0 / 9.0 if src == '°F' else n - 273.15)
        if dst == '°C':
            return c
        if dst == '°F':
            return c * 9.0 / 5.0 + 32.0
        return c + 273.15
    return n * FACTORS[kind][src] / FACTORS[kind][dst]


def dc_drop(voltage, current, length, area, rho, kind):
    k = 1.0 if kind == 'dc1' else 2.0
    loop = length * k
    r = rho * loop / area
    drop = current * r
    percent = drop / voltage * 100.0
    return {'drop': drop, 'percent': percent, 'endVoltage': voltage - drop,
            'resistance': r, 'loopLength': loop}


def ups_runtime(capacity, voltage, dod, efficiency, load):
    nominal = capacity * voltage
    usable = nominal * dod / 100.0
    delivered = usable * efficiency / 100.0
    hours = delivered / load
    return {'nominalWh': nominal, 'usableWh': usable, 'deliveredWh': delivered,
            'hours': hours, 'minutes': hours * 60.0}


def bend(thickness, radius, angle, k, leg_a=None, leg_b=None):
    rad = math.radians(angle)
    allowance = rad * (radius + k * thickness)
    setback = (radius + thickness) * math.tan(rad / 2.0)
    deduction = 2.0 * setback - allowance
    # SPEC：A、B 必须同时给或同时省略；只给一个视为输入错误；都省略时展开长记 0。
    if (leg_a is None) != (leg_b is None):
        raise ValueError('展开长度需要同时填写边 A 与边 B，或两者都留空。')
    flat = 0.0 if leg_a is None else leg_a + leg_b - deduction
    return {'allowance': allowance, 'setback': setback, 'deduction': deduction, 'flat': flat}


def supply(phase, given, value, voltage, pf):
    apparent = value / pf if given == 'kw' else value
    active = apparent * pf
    reactive = apparent * math.sqrt(max(0.0, 1.0 - pf * pf))
    divisor = math.sqrt(3.0) * voltage if phase == 'three' else voltage
    current = apparent * 1000.0 / divisor
    return {'current': current, 'apparent': apparent, 'active': active, 'reactive': reactive}


def cabinet(loss, area, ambient, inside, k, safety):
    delta_t = inside - ambient
    natural = k * area * delta_t
    base = 3.12 * loss / delta_t
    return {'natural': natural, 'airflowBase': base, 'airflow': base * safety,
            'deltaT': delta_t, 'passiveOk': loss <= natural}


def ac_drop(system, voltage, current, length, area, rho, pf, x_km, limit):
    """交流线路压降：ΔU = k·I·(R'·cosφ + X'·sinφ)·L/1000。

    与实现独立：这里按"每公里阻抗 → 回路总长"推导，k 由相数决定（三相 √3、单相 2）。
    """
    r_km = rho * 1000.0 / area
    sin_phi = math.sqrt(max(0.0, 1.0 - pf * pf))
    factor = math.sqrt(3.0) if system == 'ac3' else 2.0
    drop = factor * current * (r_km * pf + x_km * sin_phi) * (length / 1000.0)
    percent = drop / voltage * 100.0
    return {'drop': drop, 'percent': percent, 'endVoltage': voltage - drop,
            'rKm': r_km, 'xKm': x_km, 'sinPhi': sin_phi,
            'limitPercent': limit, 'pass': percent <= limit, 'factor': factor}


def evaluate(case):
    a = case['args']
    tool = case['tool']
    if tool == 'convertUnit':
        return {'value': convert_value(float(a[0]), a[1], a[2], a[3])}
    if tool == 'dcVoltageDrop':
        return dc_drop(*(float(a[i]) for i in range(5)), a[5])
    if tool == 'upsRuntime':
        return ups_runtime(*(float(x) for x in a))
    if tool == 'bendAllowance':
        legs = [None if x is None else float(x) for x in a[4:6]]
        return bend(float(a[0]), float(a[1]), float(a[2]), float(a[3]), *legs)
    if tool == 'supplyCurrent':
        return supply(a[0], a[1], float(a[2]), float(a[3]), float(a[4]))
    if tool == 'cabinetThermal':
        return cabinet(*(float(x) for x in a))
    if tool == 'acCableDrop':
        return ac_drop(a[0], *(float(x) for x in a[1:]))
    raise ValueError('未知工具：' + tool)


def main(argv):
    with open(VECTORS, encoding='utf-8') as fh:
        vectors = json.load(fh)
    results = []
    for case in vectors['cases']:
        results.append({'id': case['id'], 'tool': case['tool'], 'expected': evaluate(case)})
    payload = {'generator': 'tools/verify/oracle.py', 'cases': results,
               'spec': vectors.get('spec', '')}
    if '--check' in argv:
        with open(EXPECTED, encoding='utf-8') as fh:
            saved = json.load(fh)
        saved_map = {c['id']: c['expected'] for c in saved['cases']}
        bad = 0
        for item in results:
            got = saved_map.get(item['id'])
            if got is None:
                print('缺少用例', item['id'])
                bad += 1
                continue
            for key, value in item['expected'].items():
                other = got.get(key)
                if isinstance(value, bool):
                    ok = value == other
                else:
                    ok = other is not None and math.isclose(value, other, rel_tol=1e-9, abs_tol=1e-12)
                if not ok:
                    print('不一致', item['id'], key, value, other)
                    bad += 1
        print('Oracle 自检：%d 个用例，%d 处不一致' % (len(results), bad))
        return 1 if bad else 0
    with open(EXPECTED, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)
    print('已写出', EXPECTED, '用例数', len(results))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
