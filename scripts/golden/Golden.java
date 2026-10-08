package Ponomar;

import java.io.*;

// Headless harness: dumps upstream results as CSV golden fixtures. Not part of the published package.
public class Golden
{
	public static void main(String[] args) throws Exception
	{
		String mode = args[0];
		int stride = Integer.parseInt(args[2]);
		try (PrintWriter out = new PrintWriter(new BufferedWriter(new OutputStreamWriter(new FileOutputStream(args[1]), "UTF-8"))))
		{
			switch (mode)
			{
				case "jdate": jdate(out, stride); break;
				case "pascha": pascha(out); break;
				case "pcalendar": pcalendar(out, stride); break;
				case "dsl": dsl(out); break;
				default: throw new IllegalArgumentException(mode);
			}
		}
	}

	// One output line per expression: its upstream eval() result in each context, or E when upstream throws.
	private static void dsl(PrintWriter out) throws IOException
	{
		java.util.List<String> expressions = java.nio.file.Files.readAllLines(java.nio.file.Paths.get("scratch/golden/dsl-expressions.txt"), java.nio.charset.StandardCharsets.UTF_8);
		java.util.List<String> contexts = java.nio.file.Files.readAllLines(java.nio.file.Paths.get("scratch/golden/dsl-contexts.csv"), java.nio.charset.StandardCharsets.UTF_8);
		String[] names = contexts.get(0).split(",");
		for (String expression : expressions)
		{
			StringBuilder row = new StringBuilder();
			for (int c = 1; c < contexts.size(); c++)
			{
				StringOp op = new StringOp();
				String[] values = contexts.get(c).split(",");
				for (int i = 0; i < names.length; i++)
				{
					op.dayInfo.put(names[i], Integer.valueOf(values[i]));
				}
				String result;
				try
				{
					result = Double.toString(op.eval(expression));
				}
				catch (Throwable t)
				{
					result = "E";
				}
				if (c > 1)
				{
					row.append(',');
				}
				row.append(result);
			}
			out.println(row);
		}
	}

	private static String ymd(JDate d)
	{
		return d.getYear() + "-" + d.getMonth() + "-" + d.getDay();
	}

	private static void jdate(PrintWriter out, int stride)
	{
		out.println("jdn,year,month,day,dow,doy");
		long first = new JDate(1, 1, 33).getJulianDay();
		long last = new JDate(12, 31, 3000).getJulianDay();
		for (long j = first; j <= last; j += stride)
		{
			JDate d = new JDate(j);
			out.println(j + "," + d.getYear() + "," + d.getMonth() + "," + d.getDay() + "," + d.getDayOfWeek() + "," + d.getDoy());
		}
	}

	private static void pascha(PrintWriter out)
	{
		out.println("year,pascha,pentecost,lentStart,apostlesFastStart,apostlesFastLength,keyOfBoundaries,indiction,solarCycle,lunarCycle");
		for (int y = 33; y <= 3000; y++)
		{
			out.println(y + "," + ymd(Paschalion.getPascha(y)) + "," + ymd(Paschalion.getPentecost(y)) + ","
				+ ymd(Paschalion.getLentStart(y)) + "," + ymd(Paschalion.getApostlesFastStart(y)) + ","
				+ Paschalion.getApostlesFastLength(y) + "," + Paschalion.getKeyOfBoundaries(y) + ","
				+ Paschalion.getIndiction(y) + "," + Paschalion.getSolarCycle(y) + "," + Paschalion.getLunarCycle(y));
		}
	}

	private static void pcalendar(PrintWriter out, int stride)
	{
		out.println("calendar,year,month,day,julianDay,am,yearJ,monthJ,dayJ,yearG,monthG,dayG");
		long first = new JDate(1, 1, 33).getJulianDay();
		long last = new JDate(12, 31, 3000).getJulianDay();
		OrderedHashtable info = new OrderedHashtable();
		info.put("LS", "en/");
		for (long j = first; j <= last; j += stride)
		{
			JDate d = new JDate(j);
			for (String cal : new String[] { PCalendar.julian, PCalendar.gregorian })
			{
				PCalendar p = new PCalendar(d, cal, info);
				out.println(cal + "," + d.getYear() + "," + d.getMonth() + "," + d.getDay() + "," + p.getJulianDay() + "," + p.getAM() + ","
					+ p.getYearJ() + "," + p.getMonthJ() + "," + p.getDayJ() + "," + p.getYearG() + "," + p.getMonthG() + "," + p.getDayG());
			}
		}
	}
}
