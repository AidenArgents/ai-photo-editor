import json
from datetime import datetime
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from matplotlib.ticker import StrMethodFormatter

work_dir = Path(r"D:\Claude-Workspace\ai-photo-editor\report_work")
data = json.loads((work_dir / "chart_series.json").read_text(encoding="utf-8"))

plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei", "Arial Unicode MS", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False

def render(rows, title, filename, dense):
    dates = [datetime.strptime(row["date"], "%Y-%m-%d") for row in rows]
    orders = [row["orders"] for row in rows]
    sales = [row["sales"] for row in rows]
    amounts = [row["amount"] for row in rows]

    fig, ax_qty = plt.subplots(figsize=(15, 5.8), dpi=140)
    ax_amt = ax_qty.twinx()
    bar_width = 0.78 if dense else 14
    ax_amt.bar(dates, amounts, width=bar_width, color="#93C5FD", alpha=0.72, label="发货金额", zorder=1)
    ax_qty.plot(dates, sales, color="#0F766E", linewidth=2.2, label="销量", zorder=3)
    ax_qty.plot(dates, orders, color="#F97316", linewidth=2.0, label="订单数量", zorder=3)

    ax_qty.set_title(title, fontsize=16, fontweight="bold", pad=14)
    ax_qty.set_ylabel("数量", color="#334155", fontsize=11)
    ax_amt.set_ylabel("发货金额", color="#2563EB", fontsize=11)
    ax_qty.yaxis.set_major_formatter(StrMethodFormatter("{x:,.0f}"))
    ax_amt.yaxis.set_major_formatter(StrMethodFormatter("{x:,.0f}"))
    ax_qty.grid(axis="y", color="#CBD5E1", linestyle="--", linewidth=0.7, alpha=0.9)
    ax_qty.set_axisbelow(True)

    if dense:
        locator = mdates.AutoDateLocator(minticks=8, maxticks=13)
        ax_qty.xaxis.set_major_locator(locator)
        ax_qty.xaxis.set_major_formatter(mdates.DateFormatter("%m-%d"))
    else:
        ax_qty.xaxis.set_major_locator(mdates.MonthLocator())
        ax_qty.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    fig.autofmt_xdate(rotation=0, ha="center")

    h1, l1 = ax_qty.get_legend_handles_labels()
    h2, l2 = ax_amt.get_legend_handles_labels()
    ax_qty.legend(h1 + h2, l1 + l2, loc="upper center", bbox_to_anchor=(0.5, 1.02), ncol=3, frameon=False)
    for spine in ["top", "right"]:
        ax_qty.spines[spine].set_visible(False)
    ax_amt.spines["top"].set_visible(False)
    fig.tight_layout()
    fig.savefig(work_dir / filename, bbox_inches="tight", facecolor="white")
    plt.close(fig)

render(data["managerDaily"], "店长维度｜按天趋势（双轴）", "combo_manager_daily.png", True)
render(data["managerMonthly"], "店长维度｜按月综合（双轴）", "combo_manager_monthly.png", False)
render(data["siteDaily"], "站点维度｜按天趋势（双轴）", "combo_site_daily.png", True)
render(data["siteMonthly"], "站点维度｜按月综合（双轴）", "combo_site_monthly.png", False)
