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
				case "day": day(out, stride, args[3]); break;
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

	// What Main.write() derives for a date: day variables, the Triodion/Pentecostarion and Menaion files it opens,
	// and the commemorations (sid:cid:rank) each yields once Cmd guards are applied. Run with cwd = vendor/ponomar.
	private static void day(PrintWriter out, int stride, String yearList) throws Exception
	{
		String[] languages = { "en/", "cu/ru/", "el/mono/" };
		java.lang.reflect.Field field = Day.class.getDeclaredField("OrderedCommemorations");
		field.setAccessible(true);
		out.println(String.join("\t", "language", "gs", "year", "month", "day", "nday", "ndayP", "ndayF", "doy", "dow", "paschalFile", "paschal", "menaion", "rankPaschal", "rankMenaion", "dRank", "tone"));
		for (String language : languages)
		{
			for (int gs = 0; gs <= 1; gs++)
			{
				for (String yearText : yearList.split(","))
				{
					int year = Integer.parseInt(yearText);
					JDate pascha = Paschalion.getPascha(year);
					JDate previous = Paschalion.getPascha(year - 1);
					JDate next = Paschalion.getPascha(year + 1);
					long first = new JDate(1, 1, year).getJulianDay();
					long last = new JDate(12, 31, year).getJulianDay();
					for (long j = first; j <= last; j += stride)
					{
						JDate today = new JDate(j);
						int dow = today.getDayOfWeek();
						int doy = today.getDoy();
						int nday = (int) JDate.difference(today, pascha);
						int ndayP = (int) JDate.difference(today, previous);
						int ndayF = (int) JDate.difference(today, next);
						OrderedHashtable info = new OrderedHashtable();
						info.put("dow", dow);
						info.put("doy", doy);
						info.put("nday", nday);
						info.put("ndayP", ndayP);
						info.put("ndayF", ndayF);
						info.put("GS", gs);
						info.put("LS", language);
						info.put("Year", today.getYear());
						info.put("dRank", 0);
						info.put("Ideographic", "0");

						String folder;
						int line;
						if (nday >= -70 && nday < 0)
						{
							folder = "xml/triodion/";
							line = Math.abs(nday);
						}
						else if (nday < -70)
						{
							folder = "xml/pentecostarion/";
							line = ndayP + 1;
						}
						else
						{
							folder = "xml/pentecostarion/";
							line = nday + 1;
						}
						String paschalFile = folder + (line >= 10 ? Integer.toString(line) : "0" + line);
						int m = today.getMonth();
						int d = today.getDay();
						String menaionFile = "xml/" + (m < 10 ? "0" + m : "" + m) + (d < 10 ? "/0" + d : "/" + d);

						Day paschal = new Day(paschalFile, info);
						Day menaion = new Day(menaionFile, info);
						int rankPaschal = paschal.getDayRank();
						int rankMenaion = menaion.getDayRank();
						out.println(String.join("\t", language, "" + gs, "" + year, "" + m, "" + d, "" + nday, "" + ndayP, "" + ndayF, "" + doy, "" + dow,
							paschalFile, describe(field, paschal), describe(field, menaion), "" + rankPaschal, "" + rankMenaion,
							"" + Math.max(rankPaschal, rankMenaion), "" + paschal.getTone()));
					}
				}
			}
		}
	}

	private static String describe(java.lang.reflect.Field field, Day day) throws Exception
	{
		StringBuilder text = new StringBuilder();
		for (Object item : (java.util.Vector) field.get(day))
		{
			Commemoration1 c = (Commemoration1) item;
			if (text.length() > 0)
			{
				text.append('|');
			}
			text.append(c.getSId()).append(':').append(c.getCId()).append(':').append(c.getRank());
		}
		return text.toString();
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
